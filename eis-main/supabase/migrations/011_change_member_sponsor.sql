-- Apply after 005_genealogy_placement.sql in the Supabase project used by the app.
-- One transaction moves existing rows; it never inserts a second username/slot.
begin;

create or replace function public.change_member_sponsor(p_member_id uuid, p_sponsor_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  moving public.members;
  sponsor public.members;
  old_parent uuid;
  rotate_branch boolean := false;
  unsafe_previous_position boolean := false;
  branch_root uuid;
  root_level integer;
begin
  if p_member_id = p_sponsor_id then
    raise exception 'Cannot set a member as their own sponsor';
  end if;

  -- Serialize relationship changes, including concurrent swaps. All links, counts
  -- and levels commit together, or PostgreSQL rolls the entire change back.
  lock table public.members in share row exclusive mode;
  select * into moving from public.members where id = p_member_id;
  if not found then raise exception 'Member not found'; end if;
  old_parent := coalesce(moving.placement_id, moving.referrer_id);

  if p_sponsor_id is not null then
    select * into sponsor from public.members where id = p_sponsor_id and status = 'approved';
    if not found then raise exception 'Sponsor not found or not approved'; end if;

    -- Follow both graphs: placement can differ from the referral sponsor.
    -- UNION (not UNION ALL) also terminates on legacy cyclic relationships.
    with recursive ancestors(origin, kind, id, parent_id) as (
      select 'target', 'placement', sponsor.id, coalesce(sponsor.placement_id, sponsor.referrer_id)
      union
      select 'target', 'sponsor', sponsor.id, sponsor.referrer_id
      union
      select 'previous', 'placement', m.id, coalesce(m.placement_id, m.referrer_id)
        from public.members m where m.id = old_parent
      union
      select 'previous', 'sponsor', m.id, m.referrer_id
        from public.members m where m.id = moving.referrer_id
      union
      select a.origin, a.kind, m.id,
        case when a.kind = 'placement' then coalesce(m.placement_id, m.referrer_id) else m.referrer_id end
        from ancestors a join public.members m on m.id = a.parent_id
    )
    select
      coalesce(bool_or(origin = 'target' and id = p_member_id), false),
      coalesce(bool_or(origin = 'previous' and id in (p_member_id, p_sponsor_id)), false)
      into rotate_branch, unsafe_previous_position
      from ancestors;

    if rotate_branch then
      -- Promote the chosen downline into the moving member's previous position
      -- before reversing the relationship. Other downlines stay with their owner.
      -- An already-corrupt previous position is detached instead of reused.
      update public.members set
        referrer_id = case when unsafe_previous_position then null else moving.referrer_id end,
        placement_id = case when unsafe_previous_position then null else old_parent end
        where id = p_sponsor_id;
      if not found then raise exception 'Could not move the new sponsor'; end if;
    end if;
  end if;

  update public.members set referrer_id = p_sponsor_id, placement_id = p_sponsor_id
    where id = p_member_id;
  if not found then raise exception 'Could not move the member'; end if;

  -- Recount actual occupied tree slots, never increment/decrement stale counters.
  -- Include the previous placement parent, which is not always the old sponsor.
  update public.members parent set direct_downlines_count = (
    select count(*) from public.members child
      where child.status = 'approved'
        and coalesce(child.placement_id, child.referrer_id) = parent.id
  ) where parent.id = any(array[
    p_member_id, p_sponsor_id, old_parent, moving.referrer_id,
    coalesce(sponsor.placement_id, sponsor.referrer_id), sponsor.referrer_id
  ]);

  branch_root := case when rotate_branch then p_sponsor_id else p_member_id end;
  with recursive ancestors(id, parent_id) as (
    select m.id, coalesce(m.placement_id, m.referrer_id) from public.members m
      where m.id = (select coalesce(placement_id, referrer_id) from public.members where id = branch_root)
    union
    select m.id, coalesce(m.placement_id, m.referrer_id)
      from public.members m join ancestors a on m.id = a.parent_id
  )
  select count(*) into root_level from ancestors;

  with recursive branch(id, depth, path) as (
    select branch_root, root_level, array[branch_root]
    union all
    select m.id, b.depth + 1, b.path || m.id
      from public.members m join branch b on coalesce(m.placement_id, m.referrer_id) = b.id
      where not m.id = any(b.path)
  )
  update public.members m set tree_level = b.depth from branch b where m.id = b.id;
end;
$$;

-- Keep the caller's existing table permissions/RLS; never elevate this RPC.
revoke all on function public.change_member_sponsor(uuid, uuid) from public;
grant execute on function public.change_member_sponsor(uuid, uuid) to anon;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.change_member_sponsor(uuid, uuid) to authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
