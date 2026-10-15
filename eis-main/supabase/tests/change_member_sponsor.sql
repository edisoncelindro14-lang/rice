-- Run with psql -v ON_ERROR_STOP=1 after migration 011. Fixtures always roll back.
begin;
set local role anon;

do $$
declare
  root_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  cha_id uuid := gen_random_uuid();
  ruben_id uuid := gen_random_uuid();
  middle_id uuid := gen_random_uuid();
  leaf_id uuid := gen_random_uuid();
  sibling_id uuid := gen_random_uuid();
  fixture_ids uuid[];
  moving_id uuid;
  target_id uuid;
  snapshot jsonb;
  after_snapshot jsonb;
  failed boolean;
  cyclic boolean;
  i integer;
begin
  fixture_ids := array[root_id, other_id, cha_id, ruben_id, middle_id, leaf_id, sibling_id];
  insert into public.members (id, username, password, full_name, status, referrer_id, placement_id, tree_level) values
    (root_id, 'swap-root-' || root_id, 'test-only', 'Swap root', 'approved', null, null, 0),
    (other_id, 'swap-other-' || other_id, 'test-only', 'Other root', 'approved', null, null, 0),
    (cha_id, 'swap-cha-' || cha_id, 'test-only', 'Cha test', 'approved', root_id, root_id, 1),
    (ruben_id, 'swap-ruben-' || ruben_id, 'test-only', 'Ruben test', 'approved', cha_id, cha_id, 2),
    (middle_id, 'swap-middle-' || middle_id, 'test-only', 'Middle test', 'approved', other_id, other_id, 1),
    (leaf_id, 'swap-leaf-' || leaf_id, 'test-only', 'Leaf test', 'approved', ruben_id, ruben_id, 3),
    (sibling_id, 'swap-sibling-' || sibling_id, 'test-only', 'Sibling test', 'approved', cha_id, cha_id, 2);

  -- Reverse the same two members repeatedly. The old parent keeps one slot,
  -- each username remains one row, and other downlines stay with their member.
  for i in 1..10 loop
    moving_id := case when i % 2 = 1 then cha_id else ruben_id end;
    target_id := case when i % 2 = 1 then ruben_id else cha_id end;
    perform public.change_member_sponsor(moving_id, target_id);
    assert (select referrer_id = target_id and placement_id = target_id from public.members where id = moving_id), 'Member did not move';
    assert (select referrer_id = root_id and placement_id = root_id from public.members where id = target_id), 'New sponsor did not take the previous position';
    assert (select count(*) = 1 from public.members where id = any(array[cha_id, ruben_id]) and coalesce(placement_id, referrer_id) = root_id), 'Old sponsor has duplicate occupied slots';
    assert (select placement_id = ruben_id from public.members where id = leaf_id), 'Ruben lost his other downline';
    assert (select placement_id = cha_id from public.members where id = sibling_id), 'Cha lost her other downline';
    assert not exists (
      select 1 from public.members parent where parent.id = any(fixture_ids)
        and parent.id <> other_id and parent.direct_downlines_count <> (
          select count(*) from public.members child where child.status = 'approved'
            and coalesce(child.placement_id, child.referrer_id) = parent.id
        )
    ), 'Downline counter drifted';
    assert (select tree_level = 1 from public.members where id = target_id), 'Promoted sponsor has wrong level';
    assert (select tree_level = 2 from public.members where id = moving_id), 'Moved member has wrong level';
    assert (select count(*) = 7 from public.members where id = any(fixture_ids)), 'A member row was duplicated';
  end loop;

  -- Re-selecting the same sponsor is idempotent, not another occupied slot.
  select jsonb_agg(to_jsonb(m) order by id) into snapshot from public.members m where id = any(fixture_ids);
  perform public.change_member_sponsor(ruben_id, cha_id);
  perform public.change_member_sponsor(ruben_id, cha_id);
  select jsonb_agg(to_jsonb(m) order by id) into after_snapshot from public.members m where id = any(fixture_ids);
  assert snapshot = after_snapshot, 'Same-sponsor selection changed counts or relationships';

  -- Indirect descendant swaps must break the full path, not just direct links.
  update public.members set referrer_id = cha_id, placement_id = cha_id where id = middle_id;
  update public.members set referrer_id = middle_id, placement_id = middle_id where id = ruben_id;
  perform public.change_member_sponsor(cha_id, ruben_id);
  assert (select placement_id = root_id from public.members where id = ruben_id), 'Indirect sponsor was not promoted';
  assert (select placement_id = cha_id and tree_level = 3 from public.members where id = middle_id), 'Intermediate branch was lost';

  -- Ordinary transfers free the old slot, including a distinct placement parent.
  update public.members set referrer_id = other_id, placement_id = root_id where id = cha_id;
  perform public.change_member_sponsor(cha_id, ruben_id);
  assert (select direct_downlines_count = 1 from public.members where id = root_id), 'Previous placement slot was not freed';
  assert (select direct_downlines_count = 0 from public.members where id = other_id), 'Count used referral sponsor instead of placement';

  -- A cycle in either independent graph must be resolved.
  update public.members set referrer_id = root_id, placement_id = root_id where id = cha_id;
  update public.members set referrer_id = other_id, placement_id = cha_id where id = ruben_id;
  perform public.change_member_sponsor(cha_id, ruben_id);
  assert (select referrer_id = root_id and placement_id = root_id from public.members where id = ruben_id), 'Placement-only cycle was not rotated';
  update public.members set referrer_id = root_id, placement_id = root_id where id = cha_id;
  update public.members set referrer_id = cha_id, placement_id = other_id where id = ruben_id;
  perform public.change_member_sponsor(cha_id, ruben_id);
  assert (select referrer_id = root_id and placement_id = root_id from public.members where id = ruben_id), 'Sponsor-only cycle was not rotated';
  assert (select direct_downlines_count = 0 from public.members where id = other_id), 'Promoted sponsor left a stale placement count';

  -- Legacy multi-member cycles cannot cause recursion or survive a swap.
  update public.members set referrer_id = middle_id, placement_id = middle_id where id = cha_id;
  update public.members set referrer_id = ruben_id, placement_id = ruben_id where id = middle_id;
  update public.members set referrer_id = cha_id, placement_id = cha_id where id = ruben_id;
  perform public.change_member_sponsor(cha_id, ruben_id);
  assert (select referrer_id is null and placement_id is null from public.members where id = ruben_id), 'Legacy cycle was not detached';
  with recursive paths(kind, id, parent_id, path, cycle) as (
    select 'placement', id, coalesce(placement_id, referrer_id), array[id], false from public.members where id = any(fixture_ids)
    union all
    select 'sponsor', id, referrer_id, array[id], false from public.members where id = any(fixture_ids)
    union all
    select p.kind, m.id,
      case when p.kind = 'placement' then coalesce(m.placement_id, m.referrer_id) else m.referrer_id end,
      p.path || m.id, m.id = any(p.path)
      from paths p join public.members m on m.id = p.parent_id where not p.cycle
  ) select bool_or(cycle) into cyclic from paths;
  assert not cyclic, 'A circular relationship remains';

  perform public.change_member_sponsor(cha_id, null);
  assert (select referrer_id is null and placement_id is null and tree_level = 0 from public.members where id = cha_id), 'Root transfer failed';

  -- Invalid saves must leave every fixture unchanged.
  select jsonb_agg(to_jsonb(m) order by id) into snapshot from public.members m where id = any(fixture_ids);
  failed := false;
  begin
    perform public.change_member_sponsor(cha_id, cha_id);
  exception when raise_exception then failed := true;
  end;
  assert failed, 'Self-sponsorship was accepted';
  failed := false;
  begin
    perform public.change_member_sponsor(cha_id, gen_random_uuid());
  exception when raise_exception then failed := true;
  end;
  assert failed, 'Missing sponsor was accepted';
  select jsonb_agg(to_jsonb(m) order by id) into after_snapshot from public.members m where id = any(fixture_ids);
  assert snapshot = after_snapshot, 'Failed change partially modified members';

  raise notice 'Sponsor swaps, counts, levels, cycle repair, idempotency and invalid saves passed';
end;
$$;

reset role;

-- Force a failure after links and counters have already been updated. The RPC
-- must still roll back every change, not leave a half-completed interchange.
create function pg_temp.reject_swap_level_update() returns trigger language plpgsql as $$
begin
  raise exception 'Test failure while updating tree levels';
end;
$$;
create trigger reject_swap_level_update before update of tree_level on public.members
  for each row when (new.username like 'atomic-swap-cha-%')
  execute function pg_temp.reject_swap_level_update();

do $$
declare
  root_id uuid := gen_random_uuid();
  cha_id uuid := gen_random_uuid();
  ruben_id uuid := gen_random_uuid();
  fixture_ids uuid[];
  snapshot jsonb;
  after_snapshot jsonb;
  failed boolean := false;
begin
  fixture_ids := array[root_id, cha_id, ruben_id];
  insert into public.members (id, username, password, status, referrer_id, placement_id) values
    (root_id, 'atomic-swap-root-' || root_id, 'test-only', 'approved', null, null),
    (cha_id, 'atomic-swap-cha-' || cha_id, 'test-only', 'approved', root_id, root_id),
    (ruben_id, 'atomic-swap-ruben-' || ruben_id, 'test-only', 'approved', cha_id, cha_id);
  select jsonb_agg(to_jsonb(m) order by id) into snapshot from public.members m where id = any(fixture_ids);
  begin
    perform public.change_member_sponsor(cha_id, ruben_id);
  exception when raise_exception then
    if sqlerrm <> 'Test failure while updating tree levels' then raise; end if;
    failed := true;
  end;
  assert failed, 'Expected a failure after the relationship updates';
  select jsonb_agg(to_jsonb(m) order by id) into after_snapshot from public.members m where id = any(fixture_ids);
  assert snapshot = after_snapshot, 'A late failure left partial changes';
  raise notice 'Late database failure rolled back all sponsor, placement, count and level changes';
end;
$$;

rollback;
