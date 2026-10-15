# Mamlakah

GitHub/Vercel/Supabase rebuild of the Mamlakah Network System.

## Stack

- React + Vite
- Supabase PostgreSQL/Auth/Realtime/Storage
- Vercel
- Tailwind-style responsive CSS
- Lucide React

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql`.
3. Run `supabase/migrations/002_redeem_function.sql`.
4. Deploy the `redeem-maintenance-code` Edge Function.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel.
6. Run `npm install`.
7. Run `npm run dev`.
8. Push to GitHub and connect the repository to Vercel.

## Sponsor changes

Before using **Admin → Change Sponsor**, apply `supabase/migrations/005_genealogy_placement.sql` and then `supabase/migrations/011_change_member_sponsor.sql` in the Supabase SQL Editor. Vercel frontend deployments do not apply SQL migrations. The local Base44 environment applies the sponsor migration automatically.

Sponsor changes move the existing member record, updating both the sponsor and placement links in one database transaction. Selecting a downline as the new sponsor promotes that downline into the member's previous position first, so the two members can be reversed repeatedly without cycles or duplicate occupied slots. Other downlines remain attached to their existing parent. Actual placement counts and affected tree levels are recalculated; failed changes roll back completely. The function uses the caller's existing table permissions and RLS.

Regression check (temporary fixtures are rolled back):

```sh
docker compose -f docker-compose.base44.yml exec -T db psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/change_member_sponsor.sql
```

## Security

Never commit `.env` files or the Supabase service-role key.

The included frontend is a functional foundation. Admin CRUD, complete five-level recursive genealogy UI, withdrawal approval UI, CSV import/export, receipt upload UI, and role-management screens should be completed against the protected database functions before production launch.

## Important

The original Base44 specification described plaintext passwords. This rebuild deliberately does not store plaintext passwords. Use Supabase Auth and server-side Edge Functions for authentication and sensitive operations.
