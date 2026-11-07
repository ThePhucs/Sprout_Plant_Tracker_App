# Admin tasks

Everything happens in the Supabase dashboard. No code or deploy needed.

## Verify someone (30 → 150 photos)

**Table Editor → profiles** → find their `username` → tick `verified` → Save.

To give one person a different limit, type a number in `photo_limit` (empty = 30 or 150 depending on `verified`).

## Reset a forgotten password

**SQL Editor**, paste, replace the two values, Run:

```sql
update auth.users
set encrypted_password = extensions.crypt('TEMPORARY_PASSWORD', extensions.gen_salt('bf'))
where email = 'USERNAME@sprout.local';
```

It should say "1 row affected". Send them the temporary password on Messenger.

## Change the account limit (default 30)

**Table Editor → app_settings** → change `max_accounts`.

## See who receives notifications

**Table Editor → push_subscriptions**: one row per device. `last_success_at` shows the last push that arrived at the push service; `last_error` shows why one failed.

## Remove an account

**Authentication → Users** → the user's `…` menu → Delete user. Their profile and devices are deleted with it.
