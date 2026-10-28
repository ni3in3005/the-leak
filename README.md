# The Leak

Subscription tracker rewritten for Cloudflare's free tier.

| Layer | Tech |
| --- | --- |
| Frontend | React (Vite) on **Cloudflare Pages** |
| Backend | **Cloudflare Workers** (Hono) |
| Database | **Cloudflare D1** (source of truth) |
| Auth | **Clerk** (sign-in gated) |
| Storage | **Cloudflare R2** (JSON import/export backups only) |

Keeps the original **The Leak** UI: live ticking spend, billing countdown gauges, category chart, CRUD, plus cloud sync and JSON import/export.

## Monorepo layout

```
apps/web          React SPA → Cloudflare Pages
apps/api          Hono Worker → D1 + R2 + Clerk JWT
packages/shared   Types + billing math + demo seed data
migrations/       D1 SQL migrations
```

## Prerequisites

- Node 20+
- Cloudflare account (`npx wrangler login`)
- Clerk application (free)

## 1. Install

```bash
npm install
npm run build --workspace=@leak/shared
```

## 2. Create Cloudflare resources

```bash
# D1
cd apps/api
npx wrangler d1 create leak-db
# Copy the database_id into apps/api/wrangler.toml

# R2
npx wrangler r2 bucket create leak-backups
```

Apply migrations:

```bash
# from repo root
npm run db:migrate:local
npm run db:migrate:remote
```

## 3. Configure Clerk

1. Create a Clerk app at https://dashboard.clerk.com
2. Enable the auth methods you want
3. Add your Pages URL (and `http://localhost:5173`) to allowed origins
4. Copy keys into env files (below)

## 4. Environment files

**`apps/api/.dev.vars`** (from `.dev.vars.example`):

```
CLERK_SECRET_KEY=sk_test_...
```

**`apps/api/wrangler.toml`** `[vars]`:

```toml
CLERK_PUBLISHABLE_KEY = "pk_test_..."
CORS_ORIGIN = "http://localhost:5173,https://the-leak.pages.dev"
```

Production secret:

```bash
cd apps/api
npx wrangler secret put CLERK_SECRET_KEY
```

**`apps/web/.env.local`** (from `.env.example`):

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=
```

Leave `VITE_API_URL` empty for local Vite proxy to the Worker on `:8787`.  
For production Pages, set it to your Worker URL, e.g. `https://leak-api.<account>.workers.dev`.

## 5. Local development

**Important:** local API always uses `--local` (SQLite on your machine). Do **not** press keys / flags that switch Wrangler to **remote** preview until you have a real D1 `database_id`.

```bash
# once — create local D1 tables
npm run db:migrate:local

# terminal 1 — API (local D1 + local R2)
npm run dev:api

# terminal 2 — React
npm run dev:web
```

Open http://localhost:5173 — sign in with Clerk, then the app loads. First visit with an empty account seeds the original demo subscriptions once.

### Local troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot read properties of undefined (reading 'prepare')` | D1 binding missing — usually Wrangler ran in **remote** mode with a placeholder DB id. Stop the API, run `npm run db:migrate:local`, then `npm run dev:api` (must show local, not “Starting remote preview…”). |
| Log says `Starting remote preview…` / `Shutting down local server…` | You left local mode. Restart with `npm run dev:api` and do not pass `--remote`. |
| `no such table: subscriptions` | Run `npm run db:migrate:local`, restart API. |
| `/health` shows `"hasDb": false` | Bindings not loaded — confirm `apps/api/wrangler.toml` has a `[[d1_databases]]` block and you are on `--local`. |

## 6. Deploy (free tier)

```bash
# API Worker
npm run deploy:api

# Frontend Pages
# set VITE_API_URL to the Worker URL before building
VITE_API_URL=https://leak-api.<account>.workers.dev npm run build --workspace=@leak/web
npm run deploy --workspace=@leak/web
```

Or connect the `apps/web` build to Cloudflare Pages in the dashboard (`npm run build --workspace=@leak/web`, output `apps/web/dist`).

After deploy, update:

- Clerk allowed origins → your `*.pages.dev` URL
- Worker `CORS_ORIGIN` → same Pages URL
- `VITE_API_URL` → Worker URL, rebuild & redeploy Pages

## API (all require `Authorization: Bearer <Clerk JWT>` except `/health`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/api/subscriptions` | List current user's subs |
| POST | `/api/subscriptions` | Create |
| PUT | `/api/subscriptions/:id` | Update |
| DELETE | `/api/subscriptions/:id` | Delete |
| POST | `/api/subscriptions/:id/pause` | Pause as of a date (`pausedAt`) |
| POST | `/api/subscriptions/:id/resume` | Resume (clear pause) |
| POST | `/api/seed` | Seed demo data once if empty |
| POST | `/api/export` | JSON export + R2 backup |
| POST | `/api/import` | Import JSON (`mode`: `replace` \| `merge`) + R2 backup |
| GET | `/api/me` | User meta |

## Data model (D1)

`subscriptions`: `id`, `user_id`, `name`, `category`, `currency`, `cost`, `start_date`, `billing_cycle`, timestamps.  
`user_meta`: tracks whether demo seed already ran for a user.

R2 keys: `exports/{userId}/{ts}-subscriptions.json`, `imports/{userId}/{ts}-subscriptions.json`.

## Notes

- Multi-user: every row is scoped by Clerk `user_id`.
- Categories stay fixed: AI Tool, OTT, Mobile/Internet, Other.
- Free-tier friendly: Workers, Pages, D1, and R2 all have free allowances; Clerk has a free plan.
