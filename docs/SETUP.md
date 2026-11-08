# First-time setup

Do these once, in order. Secret values only ever go into files on your PC or into Cloudflare; never into chat or git.

## 1. Supabase settings (dashboard)

Project: `rjiddirzqhikcqhkiyfi`

1. **Authentication → Sign In / Providers → Email**
   - **Allow new users to sign up**: on
   - **Confirm email**: **off** (there are no real emails; usernames become `name@sprout.local`)
   - **Minimum password length**: 8
2. **SQL Editor → New query**: run each file in `supabase/migrations/` in order (`0001_…`, then `0002_…`), one at a time: paste, **Run**, check it says Success.
3. **Project Settings → API Keys**: you need the **publishable** key (`sb_publishable_…`) and a **secret** key (`sb_secret_…`).

## 2. Local files on your PC

- `.env.local`: paste the publishable key after `VITE_SUPABASE_PUBLISHABLE_KEY=` (the URL and push public key are already filled in).
- `.dev.vars`: add a line `SUPABASE_SECRET_KEY=sb_secret_…` (the push private key is already there).

Both files are git-ignored. Check with `git status`: they must never appear.

## 3. Try it on your PC

```bash
npm run dev
```

Open http://localhost:5173, create an account and press **Turn on notifications** → **Send a test notification**. Desktop Chrome receives pushes on localhost.

## 4. Deploy to Cloudflare

```bash
npx wrangler login
```

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
```

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
```

For the second secret, paste the value from `.dev.vars`. Then:

```bash
npm run deploy
```

The app is then live at `https://sprout.<your-subdomain>.workers.dev`.

## 5. Make yourself admin

Supabase → **Table Editor → profiles** → your row → tick `is_admin` and `verified`. You'll then get a push for each new sign-up.

## 6. Test on real phones

- **iPhone (iOS 16.4+)**: open the link in Safari → Share → Add to Home Screen → open Sprout from the Home Screen → create account → turn on notifications → send test.
- **Android**: open in Chrome → Install → open from Home Screen → same steps.
- Also try opening the link from **Messenger** to check the "open in browser" screen.
