# Owner-only admin dashboard bootstrap

## Authorization model

- Administrator identity is stored only in `public.admin_users`.
- `admin_users` has RLS enabled and no policies for `anon` or
  `authenticated`; only `service_role` can read or modify it.
- The browser never receives the Supabase service-role key. The
  `website/supabase/functions/admin-dashboard` function validates the signed-in
  user's JWT, verifies that `public.admin_users` contains an active row for that
  user, and only then performs privileged reads through the service-role client.
- Hiding the `/admin` route or passing a frontend role flag is not
  authorization.
- `profiles` cannot self-assign privileges because no admin role field exists
  there; profile updates are restricted to display-related fields.

## Owner bootstrap (controlled process)

Do this only after the owner has chosen the exact administrator account.

1. Create the intended owner account through the normal Supabase Auth sign-up
   flow and confirm its email.
2. In the Supabase SQL editor or a reviewed SQL run, obtain the account ID
   without exposing any secret:

   ```sql
   select id, email from auth.users where email = '<owner-email>';
   ```

3. Insert the active administrator record with the SQL editor/service role only:

   ```sql
   insert into public.admin_users (user_id, role, granted_by)
   values ('<OWNER_USER_UUID>', 'owner', '<OWNER_USER_UUID>')
   on conflict (user_id) do nothing;
   ```

4. Confirm the record exists:

   ```sql
   select user_id, role, granted_at, revoked_at
   from public.admin_users
   where user_id = '<OWNER_USER_UUID>';
   ```

5. Sign in at `/admin`. Access is denied for every account not present in
   `admin_users`.

Revocation is performed by setting `revoked_at`, not by deleting the row, so
an audit trail remains.

## Why the approved owner bootstrap may set `granted_by = user_id`

The migration allows `granted_by` to equal `user_id` only when `role = 'owner'`.

This is safe because:

- The insertion is performed only through a trusted SQL editor or
  service-role process controlled by the owner.
- The exact owner account is selected explicitly before the insert.
- Ordinary users have no permissions on `admin_users`.
- The browser cannot assign or modify administrative roles.
- A revoked owner record can be retained while a new active ownership
  assignment is recorded deliberately.
- Administrative reads are audited, and authorization remains fail closed.

## Testing status

- Preview stacks must use non-production data.
- Do not add admin privileges to any account until the owner approves the
  exact account and secure bootstrap procedure.