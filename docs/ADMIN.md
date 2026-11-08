# Admin guide

Everything here is done in the Supabase dashboard. No code, no deploy.

> The dashboard shows **everyone's** data (it bypasses the app's privacy rules). Only open what a task needs.

## Accounts

| Task | Where | How |
|---|---|---|
| See who signed up | **Table Editor → profiles** | One row per person: `username`, `display_name`, `created_at` |
| Verify someone (30 → 150 photos) | **Table Editor → profiles** | Tick `verified`, Save |
| Give someone a custom photo limit | **Table Editor → profiles** | Type a number in `photo_limit` (empty = 30, or 150 when verified) |
| Get "new sign-up" notifications | **Table Editor → profiles** | Tick `is_admin` on your own row |
| Change the account cap (default 30) | **Table Editor → app_settings** | Edit `max_accounts` |
| Delete an account | **Authentication → Users** | `…` menu → Delete user. Their profile, plants, logs and devices go with it; their photo files are removed by the next weekly clean-up |

### Reset a forgotten password

**SQL Editor**, paste, replace the two values, Run:

```sql
update auth.users
set encrypted_password = extensions.crypt('TEMPORARY_PASSWORD', extensions.gen_salt('bf'))
where email = 'USERNAME@sprout.local';
```

It should say "1 row affected". Send them the temporary password on Messenger, and ask them to change it in **Cài đặt → Đổi mật khẩu**.

## Reminders

| Task | Where | How |
|---|---|---|
| Is someone receiving notifications? | **Table Editor → push_subscriptions** | One row per device. `last_success_at` = last push delivered to the push service; `last_error` = why one failed |
| No row for someone | | They haven't turned on notifications, or their phone dropped the subscription. Opening the app re-registers it |
| Did the hourly job run? | Cloudflare → **Workers & Pages → sprout → Logs** | Cron runs every hour on the hour |

## Storage and limits

| Task | Where |
|---|---|
| How much of the free plan is used (database 500 MB, storage 1 GB, bandwidth) | **Project Settings → Usage** (or the project home page) |
| Browse photo files | **Storage → photos**: one folder per user id; `name.jpg` (full) + `name_t.jpg` (thumbnail) |
| Find a user's id | **Table Editor → profiles** → `id` column |

Delete photos through the app, not in Storage: deleting a file here leaves the care log pointing at a missing image.

## Things to know

- **Backups:** the free plan keeps no backups you can restore. To keep a copy, use **Table Editor → (table) → Export → CSV** for `plants`, `care_logs` and `profiles`.
- **Project pausing:** free projects pause after a week of no activity. The app's hourly job reads the database, so it stays awake. If it ever pauses, click **Restore** on the project page.
- **Database changes** live in `supabase/migrations/`. Run new files in order in the SQL Editor, once each.
