# Sprout 🌱

A plant-care app for the web: watering reminders by push notification, care logs and a photo journal, in Vietnamese and English. It's a standalone web version of my Android app (Kotlin, Jetpack Compose, Room), built for friends and family on iPhone and Android, and it runs at no cost.

> Status: **push-notification prototype**. Accounts, install flow and daily reminders work; plants and photos come next.

## Stack

| Part | Choice | Why |
|---|---|---|
| App | React + TypeScript + Vite, installable PWA | Works on iPhone and Android with no app store |
| Data and accounts | Supabase (Postgres, Auth, Storage), Singapore region | Free tier, row-level security |
| Hosting and jobs | One Cloudflare Worker: serves the app and runs an hourly cron | Free, nothing to maintain |
| Push | Web Push (VAPID), payload encrypted in the Worker with Web Crypto | Works on iOS 16.4+ and Android |

## Design decisions

- **Free and maintenance-free**: no paid services, no custom domain, no email. The hourly job also keeps the free database from pausing.
- **Security in the database, not the app**: every table has row-level security and explicit grants, and the sign-up cap is enforced by a database trigger.
- **iPhone first**: installation is required before login, because iOS gives the Home Screen app separate storage from Safari. Facebook and Messenger in-app browsers are detected and sent to a real browser.
- **Self-healing notifications**: devices re-register on every open, and dead subscriptions are removed when pushes fail.
- **Reminders follow each user's time zone**, including US daylight saving.

## Development

```bash
npm install
```

```bash
npm run dev
```

`npm test` runs the unit tests, `npm run typecheck` checks the app and the Worker, and `npm run deploy` builds and deploys. First-time setup is in [docs/SETUP.md](docs/SETUP.md), and admin tasks are in [docs/ADMIN.md](docs/ADMIN.md).
