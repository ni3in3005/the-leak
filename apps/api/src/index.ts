import { Hono } from "hono";
import { cors } from "hono/cors";
import { DEMO_SUBSCRIPTIONS, newSubscriptionId } from "@leak/shared";
import { requireAuth } from "./auth";
import {
  countSubscriptions,
  deleteSubscription,
  getSubscription,
  insertSubscription,
  listSubscriptions,
  markSeeded,
  replaceAllSubscriptions,
  setPausedAt,
  updateSubscription,
  wasSeeded,
} from "./db";
import type { AuthVariables, Env } from "./env";
import { normalizeImportedFile, parseDateField, parseSubscriptionInput } from "./validate";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.use("*", async (c, next) => {
  // Browsers send Origin without a trailing slash — normalize both sides
  const origins = (c.env.CORS_ORIGIN || "http://localhost:5173,https://the-leak.pages.dev")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const corsMiddleware = cors({
    origin: origins,
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });
  return corsMiddleware(c, next);
});

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "leak-api",
    hasDb: Boolean(c.env.DB),
    hasR2: Boolean(c.env.BACKUPS),
  })
);

/** Guard: D1/R2 missing usually means `wrangler dev --remote` without a real D1 id. */
app.use("/api/*", async (c, next) => {
  if (!c.env.DB) {
    return c.json(
      {
        error:
          "D1 database binding (DB) is missing. Run the API with `npm run dev:api` (uses --local), then `npm run db:migrate:local`. Do not use `wrangler dev --remote` until you have created a real D1 database and put its database_id in wrangler.toml.",
      },
      500
    );
  }
  if (!c.env.BACKUPS) {
    return c.json(
      {
        error:
          "R2 binding (BACKUPS) is missing. Use local mode (`wrangler dev --local`) for development.",
      },
      500
    );
  }
  await next();
});

app.use("/api/*", requireAuth);

app.get("/api/subscriptions", async (c) => {
  const userId = c.get("userId");
  try {
    const subscriptions = await listSubscriptions(c.env.DB, userId);
    return c.json({ subscriptions });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Common when migrations were never applied locally
    if (/no such table/i.test(message)) {
      return c.json(
        {
          error:
            "D1 tables are missing. From the repo root run: npm run db:migrate:local — then restart npm run dev:api.",
        },
        500
      );
    }
    throw err;
  }
});

app.post("/api/subscriptions", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  const parsed = parseSubscriptionInput(body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const id = newSubscriptionId();
  const sub = await insertSubscription(c.env.DB, userId, id, parsed);
  return c.json({ subscription: sub }, 201);
});

app.put("/api/subscriptions/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const parsed = parseSubscriptionInput(body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const sub = await updateSubscription(c.env.DB, userId, id, parsed);
  if (!sub) return c.json({ error: "Not found" }, 404);
  return c.json({ subscription: sub });
});

app.delete("/api/subscriptions/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const ok = await deleteSubscription(c.env.DB, userId, id);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

/** Pause a subscription as of a given date (YYYY-MM-DD). */
app.post("/api/subscriptions/:id/pause", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => null);
  const pausedAt = parseDateField(
    body && typeof body === "object" ? (body as { pausedAt?: unknown }).pausedAt : undefined,
    "pausedAt"
  );
  if (pausedAt && typeof pausedAt === "object" && "error" in pausedAt) {
    return c.json({ error: pausedAt.error }, 400);
  }
  if (!pausedAt) {
    return c.json({ error: "pausedAt (YYYY-MM-DD) is required" }, 400);
  }

  const existing = await getSubscription(c.env.DB, userId, id);
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (pausedAt < existing.startDate) {
    return c.json({ error: "Pause date cannot be before the start date" }, 400);
  }

  const sub = await setPausedAt(c.env.DB, userId, id, pausedAt);
  if (!sub) return c.json({ error: "Not found" }, 404);
  return c.json({ subscription: sub });
});

/** Resume a paused subscription. */
app.post("/api/subscriptions/:id/resume", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const sub = await setPausedAt(c.env.DB, userId, id, null);
  if (!sub) return c.json({ error: "Not found" }, 404);
  return c.json({ subscription: sub });
});

/** Seed demo data once per user when they have zero subscriptions. */
app.post("/api/seed", async (c) => {
  const userId = c.get("userId");
  const count = await countSubscriptions(c.env.DB, userId);
  if (count > 0) {
    return c.json({ seeded: false, reason: "already_has_data", subscriptions: await listSubscriptions(c.env.DB, userId) });
  }
  if (await wasSeeded(c.env.DB, userId)) {
    return c.json({ seeded: false, reason: "already_seeded", subscriptions: [] });
  }

  const items = DEMO_SUBSCRIPTIONS.map((s) => ({
    id: newSubscriptionId(),
    name: s.name,
    category: s.category,
    currency: s.currency,
    cost: s.cost,
    startDate: s.startDate,
    billingCycle: s.billingCycle ?? "monthly",
  }));

  await replaceAllSubscriptions(c.env.DB, userId, items);
  await markSeeded(c.env.DB, userId);
  const subscriptions = await listSubscriptions(c.env.DB, userId);
  return c.json({ seeded: true, subscriptions });
});

/**
 * Export subscriptions JSON.
 * Stores a backup copy in R2 under exports/{userId}/{timestamp}.json
 * and returns the JSON payload for download.
 */
app.post("/api/export", async (c) => {
  const userId = c.get("userId");
  const subscriptions = await listSubscriptions(c.env.DB, userId);
  const payload = { subscriptions };
  const json = JSON.stringify(payload, null, 2);
  const key = `exports/${userId}/${Date.now()}-subscriptions.json`;
  await c.env.BACKUPS.put(key, json, {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { userId, type: "export" },
  });
  return c.json({
    key,
    filename: "subscriptions.json",
    data: payload,
  });
});

/**
 * Import subscriptions from JSON body.
 * Stores the uploaded JSON in R2, then replaces the user's D1 rows.
 * Body: { subscriptions: [...], mode?: "replace" | "merge" }
 */
app.post("/api/import", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const mode = (body as { mode?: string }).mode === "merge" ? "merge" : "replace";
  const normalized = normalizeImportedFile(body);
  if ("error" in normalized) return c.json({ error: normalized.error }, 400);

  const key = `imports/${userId}/${Date.now()}-subscriptions.json`;
  await c.env.BACKUPS.put(key, JSON.stringify(body, null, 2), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: { userId, type: "import", mode },
  });

  if (mode === "replace") {
    await replaceAllSubscriptions(
      c.env.DB,
      userId,
      normalized.map((s) => ({
        id: newSubscriptionId(),
        name: s.name,
        category: s.category,
        currency: s.currency,
        cost: s.cost,
        startDate: s.startDate,
        billingCycle: s.billingCycle,
        pausedAt: s.pausedAt ?? null,
      }))
    );
  } else {
    for (const s of normalized) {
      await insertSubscription(c.env.DB, userId, newSubscriptionId(), {
        name: s.name,
        category: s.category,
        currency: s.currency,
        cost: s.cost,
        startDate: s.startDate,
        billingCycle: s.billingCycle,
        pausedAt: s.pausedAt ?? null,
      });
    }
  }

  const subscriptions = await listSubscriptions(c.env.DB, userId);
  return c.json({ ok: true, key, mode, subscriptions });
});

app.get("/api/me", async (c) => {
  const userId = c.get("userId");
  const count = await countSubscriptions(c.env.DB, userId);
  const seeded = await wasSeeded(c.env.DB, userId);
  return c.json({ userId, subscriptionCount: count, seeded });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
