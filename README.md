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

```bash
# terminal 1 — API (D1 local + R2 local)
npm run dev:api

# terminal 2 — React
npm run dev:web
```

Open http://localhost:5173 — sign in with Clerk, then the app loads. First visit with an empty account seeds the original demo subscriptions once.

## 6. Deploy (free tier)

Deploy uploads values from **`apps/api/wrangler.toml` → `[vars]`**.  
If deploy output still shows `pk_test_…` and `CORS_ORIGIN = http://localhost:5173`, those lines were not updated before `npm run deploy:api`.

### 6a. Switch Clerk to Production keys

1. Clerk Dashboard → open your app → switch to **Production**
2. Copy:
   - Publishable key → `pk_live_…`
   - Secret key → `sk_live_…`
3. In Clerk Production, allow your live frontend origin, e.g. `https://the-leak.pages.dev`

### 6b. Edit Worker vars (required before every prod deploy that needs new origins/keys)

Open `apps/api/wrangler.toml` and set:

```toml
[vars]
CLERK_PUBLISHABLE_KEY = "pk_live_YOUR_KEY_HERE"
CORS_ORIGIN = "http://localhost:5173,https://YOUR_PAGES_SUBDOMAIN.pages.dev"
```

Example for this project’s Worker host:

```toml
CORS_ORIGIN = "http://localhost:5173,https://the-leak.pages.dev"
```

(Use your real Pages URL — check Cloudflare → Workers & Pages → your Pages project.)

Keep your real `database_id` as-is (do not put the placeholder UUID back).

### 6c. Set the Worker secret (Production)

```bash
cd apps/api
npx wrangler secret put CLERK_SECRET_KEY
# paste sk_live_... then Enter
```

### 6d. Deploy API

```bash
# from repo root
npm run deploy:api
```

Confirm the deploy summary shows:

- `CLERK_PUBLISHABLE_KEY ("pk_live_…")`  ← not `pk_test_`
- `CORS_ORIGIN` includes your `*.pages.dev` URL  ← not only localhost

### 6e. Rebuild & deploy the website (this fixes the browser Clerk warning)

The browser warning comes from the **frontend** key baked in at build time (`VITE_CLERK_PUBLISHABLE_KEY`), not from the Worker alone.

```bash
# PowerShell (Windows) — set for this session, then build + deploy
cd C:\Users\NitinBagul\vs-github\digital_coder
$env:VITE_CLERK_PUBLISHABLE_KEY="pk_live_YOUR_KEY_HERE"
$env:VITE_API_URL="https://leak-api.ni3in3005.workers.dev"
npm run build --workspace=@leak/web
npm run deploy --workspace=@leak/web
```

Or put the same two values in `apps/web/.env.local` (never commit that file), then build/deploy.

Hard-refresh the live site (`Ctrl+Shift+R`). The “development keys” console warning should go away.

### Deploy troubleshooting

| Symptom | Fix |
| --- | --- |
| Deploy still shows `pk_test_` / only localhost CORS | Edit `apps/api/wrangler.toml` `[vars]`, save, run `npm run deploy:api` again |
| Browser: “Development keys” | Rebuild Pages with `VITE_CLERK_PUBLISHABLE_KEY=pk_live_…` and redeploy web |
| Browser CORS / blocked API from Pages | Add your `https://….pages.dev` to `CORS_ORIGIN`, redeploy API |
| API 401 after switching to live keys | Re-run `wrangler secret put CLERK_SECRET_KEY` with `sk_live_…`, and use matching `pk_live_` on the web build |
## API (all require `Authorization: Bearer <Clerk JWT>` except `/health`)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/api/subscriptions` | List current user's subs |
| POST | `/api/subscriptions` | Create |
| PUT | `/api/subscriptions/:id` | Update |
| DELETE | `/api/subscriptions/:id` | Delete |
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
