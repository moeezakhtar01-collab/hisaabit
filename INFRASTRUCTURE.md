# Hisaabit Infrastructure

Single source of truth for where every part of Hisaabit lives. Update
this file whenever infrastructure changes — stale notes caused at
least one debugging detour already (assumed Supabase, was Neon).

---

## Stack at a glance

| Layer            | Provider     | Notes                                                |
|------------------|--------------|------------------------------------------------------|
| Mobile app       | Expo SDK 54  | React Native 0.81, Expo Router v6                    |
| Backend API      | Railway      | Node 20, Express. Region: `asia-southeast1-eqsg3a`   |
| **Database**     | **Neon**     | Postgres. Connected via direct URL — no Neon SDK.    |
| Email            | Resend       | Verified sending domain: `hisaabit.com`              |
| Domain & DNS     | Hostinger    | `hisaabit.com`                                       |
| AI / Voice       | OpenAI       | Whisper (transcribe) + gpt-4o-mini (extract)         |
| Source           | GitHub       | `moeezakhtar01-collab/hisaabit`                      |
| App store        | Google Play  | Internal testing track active                        |
| Build pipeline   | EAS Build    | Android AAB. versionCode auto-increments.            |

---

## 1. Source code

- Repo: https://github.com/moeezakhtar01-collab/hisaabit
- Default branch: `main`
- Pushes to `main` auto-deploy to Railway

---

## 2. Backend hosting (Railway)

- Project: `hisaabit`
- Service: `hisaabit` (Express)
- Public URL: https://hisaabit-production.up.railway.app
- Region: `asia-southeast1-eqsg3a` (Singapore)
- Auto-deploys from GitHub `main` on every push

> The `postgres-volume` item visible in the Railway project is an
> **unused storage volume**, NOT a running Postgres service. Ignore it.
> The actual database is Neon (see §3).

### Railway env vars (production)

Set in Railway → hisaabit service → Variables. Server reads via `process.env`.

| Variable                | Purpose                                          |
|-------------------------|--------------------------------------------------|
| `DATABASE_URL`          | **Neon Postgres** connection string              |
| `OPENAI_API_KEY`        | Whisper + gpt-4o-mini                            |
| `RESEND_API_KEY`        | Confirmation emails                              |
| `SESSION_SECRET`        | Session cookie signing (express-session)         |
| `APP_URL`               | Production origin allowlist for CORS             |
| `NODE_ENV`              | Auto-set to `production` by Railway              |
| `PORT`                  | Auto-set by Railway                              |

---

## 3. Database (Neon)

- Provider: https://console.neon.tech
- Project: `hisaabit` *(verify exact name in console)*
- Connection: standard Postgres URL (host ends with `.neon.tech`)
- Driver in code: `postgres-js` via `drizzle-orm/postgres-js`
- File: `server/db.ts`

### How to run ad-hoc SQL against prod

1. https://console.neon.tech → `hisaabit` project
2. Left sidebar → **SQL Editor**
3. Paste statement(s) → **Run**

### How to apply schema changes

The source of truth is `shared/schema.ts`. Drizzle Kit syncs it to the DB.

```bash
npx drizzle-kit push
```

⚠️ **Critical caveat:** `drizzle-kit push` uses `DATABASE_URL` from
`.env`. By default the local `.env` points to **localhost Postgres**,
not Neon. To push to prod:

1. Copy the Neon `DATABASE_URL` from Railway → hisaabit → Variables
2. Temporarily replace `DATABASE_URL` in local `.env` with the Neon URL
3. Run `npx drizzle-kit push`
4. Restore the original (localhost) `DATABASE_URL` in `.env`

OR just run the equivalent SQL directly in Neon's SQL Editor.

---

## 4. Local development database

- Local `.env` `DATABASE_URL`: `postgresql://postgres:...@localhost:5432/hisaabit`
- Runs on the developer's machine — Postgres on port 5432, db `hisaabit`
- **Separate from prod.** Schema can drift if not pushed to both. Keep
  this file's "How to apply schema changes" note in mind.

---

## 5. Domain & DNS (Hostinger)

- Domain: `hisaabit.com`
- Registrar: Hostinger
- DNS hosted at: Hostinger
- Records currently configured (for Resend email):
  - SPF (TXT, root)
  - DKIM (TXT, `resend._domainkey`)
  - Inbound MX: not set (Resend "Enable Receiving" toggle is off)

To manage DNS: Hostinger hPanel → Domains → `hisaabit.com` → DNS / Nameservers → DNS records.

---

## 6. Email (Resend)

- Provider: https://resend.com
- Verified sending domain: `hisaabit.com`
- Sender string used in code: `Hisaabit <noreply@hisaabit.com>`
  (in `server/routes.ts`, `sendConfirmationEmail`)
- Free tier limits: 3,000 emails/month, 100/day
- Resend account email == original Hisaabit admin email
  (so before the domain was verified, only that one address could
  receive confirmation emails — sandbox sender limitation)

---

## 7. AI / Voice (OpenAI)

- Provider: https://platform.openai.com
- Models:
  - `whisper-1` — speech-to-text (Urdu / Roman Urdu / English)
  - `gpt-4o-mini` — extracts structured expense JSON from transcript
- Endpoint: `POST /api/voice-expense` (`server/routes.ts`)
- File-size cap: 5 MB upload (multer config). Quota: 100/month
  per user (anti-abuse soft cap, see `checkAndConsumeVoiceQuota`)

---

## 8. Mobile build & distribution

### EAS Build

- Provider: https://expo.dev/accounts/moeezakhtar/projects/hisaabit
- Profile used for prod: `production` (in `eas.json`)
- versionCode: auto-increment, `appVersionSource: "remote"`
- Keystore: managed by EAS (Build Credentials ID `l2MFW607se`)
- Original keystore file at repo root: `@moeezakhtar__hisaabit.jks`
  (kept as offline backup — Play App Signing is enabled, so this
  upload key is what signs each AAB before Play re-signs for users)

Build command:
```bash
eas build --platform android --profile production
```

### Google Play Console

- Package name: `com.hisaabit.app`
- Tracks:
  - **Internal testing**: active (current: version 5)
  - **Closed testing**: pending — requires 12+ testers, 14-day window
  - **Production**: pending — requires Closed Testing completion + review

---

## 9. Common operations

### Deploy server changes
1. `git push` to `main`
2. Railway auto-deploys in ~30-60s
3. Monitor: Railway → hisaabit → Deployments

### Apply schema migration to prod
1. Edit `shared/schema.ts`
2. Either:
   - Use Neon SQL Editor (manual SQL, idempotent CREATE statements)
   - Or temporarily swap local `.env` `DATABASE_URL` to Neon URL and
     run `npx drizzle-kit push`. Restore after.

### Build a new mobile AAB
```bash
eas build --platform android --profile production
```
Then upload the resulting `.aab` URL to Play Console.

### Rotate a secret
1. Generate new value (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` for SESSION_SECRET)
2. Update Railway → hisaabit → Variables
3. Update local `.env` if used locally
4. Railway redeploys automatically

### Verify CORS / Railway is up
```bash
curl -I -H "Origin: https://hisaabit-production.up.railway.app" https://hisaabit-production.up.railway.app/api/auth/me
```
Expect `HTTP/1.1 401` + the four `Access-Control-*` headers.

---

## 10. `.env` variable reference

The local `.env` is for development only. Production values live in Railway.

| Variable                     | Used by             | Notes                                            |
|------------------------------|---------------------|--------------------------------------------------|
| `DATABASE_URL`               | server, drizzle-kit | Local: localhost. Prod (Railway): Neon.          |
| `OPENAI_API_KEY`             | server              | Whisper + gpt-4o-mini                            |
| `RESEND_API_KEY`             | server              | Confirmation emails                              |
| `SESSION_SECRET`             | server              | Session cookie signing                           |
| `APP_URL`                    | server (CORS)       | Set in Railway only; not needed in local `.env`  |
| `PORT`                       | server              | Defaults to 5000 locally                         |
| `EXPO_PUBLIC_DOMAIN`         | mobile app          | Backend API URL. Baked into AAB at build time.   |
| `SUPABASE_URL`               | **UNUSED**          | Dead var. Safe to delete.                        |
| `SUPABASE_SERVICE_ROLE_KEY`  | **UNUSED**          | Dead var. Safe to delete.                        |

---

## 11. People & access

- Owner: Moeez Akhtar
- GitHub: `moeezakhtar01-collab`
- Expo / EAS: `moeezakhtar`
- Internal testing tester emails: managed in Play Console → Internal testing → Testers
- Resend account email: same as original Hisaabit admin account

---

## 12. Things that have caught us out before

1. **`SUPABASE_*` env vars in `.env` are dead.** The codebase uses Neon
   via raw Postgres connection string (`server/db.ts`). Anything that
   says "Supabase" is a leftover from earlier exploration.
2. **`drizzle-kit push` only updates whatever DB `DATABASE_URL` points
   to.** Local `.env` → localhost. To affect prod, swap the URL first
   or run SQL in Neon SQL Editor.
3. **The `postgres-volume` service in Railway is not a database.** It's
   an unmounted volume. The real DB is on Neon.
4. **versionCode is remote-incrementing.** Don't manually bump in
   `app.json`. EAS handles it. Once a versionCode is uploaded to Play,
   it's burned forever — even if rejected.
5. **Resend free-tier sandbox sender (`onboarding@resend.dev`) only
   delivers to the Resend account owner's email.** That's why only the
   admin account could register before the domain was verified. Now
   we send from `noreply@hisaabit.com` — anyone can receive.
