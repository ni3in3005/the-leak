import type { BillingCycle, Subscription, SubscriptionInput } from "@leak/shared";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  name: string;
  category: string;
  currency: string;
  cost: number;
  start_date: string;
  billing_cycle: string;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    currency: row.currency,
    cost: row.cost,
    startDate: row.start_date,
    billingCycle: (row.billing_cycle === "yearly" ? "yearly" : "monthly") as BillingCycle,
    pausedAt: row.paused_at ?? null,
  };
}

const SELECT_COLS = `id, user_id, name, category, currency, cost, start_date, billing_cycle, paused_at, created_at, updated_at`;

export async function listSubscriptions(db: D1Database, userId: string): Promise<Subscription[]> {
  const { results } = await db
    .prepare(`SELECT ${SELECT_COLS} FROM subscriptions WHERE user_id = ? ORDER BY created_at ASC`)
    .bind(userId)
    .all<SubscriptionRow>();
  return (results ?? []).map(rowToSubscription);
}

export async function getSubscription(
  db: D1Database,
  userId: string,
  id: string
): Promise<Subscription | null> {
  const row = await db
    .prepare(`SELECT ${SELECT_COLS} FROM subscriptions WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .first<SubscriptionRow>();
  return row ? rowToSubscription(row) : null;
}

export async function insertSubscription(
  db: D1Database,
  userId: string,
  id: string,
  input: SubscriptionInput & { pausedAt?: string | null }
): Promise<Subscription> {
  await db
    .prepare(
      `INSERT INTO subscriptions (id, user_id, name, category, currency, cost, start_date, billing_cycle, paused_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      userId,
      input.name,
      input.category,
      input.currency,
      input.cost,
      input.startDate,
      input.billingCycle,
      input.pausedAt ?? null
    )
    .run();
  const sub = await getSubscription(db, userId, id);
  if (!sub) throw new Error("Failed to read created subscription");
  return sub;
}

export async function updateSubscription(
  db: D1Database,
  userId: string,
  id: string,
  input: SubscriptionInput
): Promise<Subscription | null> {
  const existing = await getSubscription(db, userId, id);
  if (!existing) return null;
  await db
    .prepare(
      `UPDATE subscriptions
       SET name = ?, category = ?, currency = ?, cost = ?, start_date = ?, billing_cycle = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND user_id = ?`
    )
    .bind(
      input.name,
      input.category,
      input.currency,
      input.cost,
      input.startDate,
      input.billingCycle,
      id,
      userId
    )
    .run();
  return getSubscription(db, userId, id);
}

export async function setPausedAt(
  db: D1Database,
  userId: string,
  id: string,
  pausedAt: string | null
): Promise<Subscription | null> {
  const existing = await getSubscription(db, userId, id);
  if (!existing) return null;
  await db
    .prepare(
      `UPDATE subscriptions
       SET paused_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND user_id = ?`
    )
    .bind(pausedAt, id, userId)
    .run();
  return getSubscription(db, userId, id);
}

export async function deleteSubscription(
  db: D1Database,
  userId: string,
  id: string
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM subscriptions WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function countSubscriptions(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) as c FROM subscriptions WHERE user_id = ?`)
    .bind(userId)
    .first<{ c: number }>();
  return row?.c ?? 0;
}

export async function wasSeeded(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT seeded FROM user_meta WHERE user_id = ?`)
    .bind(userId)
    .first<{ seeded: number }>();
  return (row?.seeded ?? 0) === 1;
}

export async function markSeeded(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_meta (user_id, seeded) VALUES (?, 1)
       ON CONFLICT(user_id) DO UPDATE SET seeded = 1`
    )
    .bind(userId)
    .run();
}

export async function replaceAllSubscriptions(
  db: D1Database,
  userId: string,
  items: Array<SubscriptionInput & { id: string; pausedAt?: string | null }>
): Promise<void> {
  const statements = [
    db.prepare(`DELETE FROM subscriptions WHERE user_id = ?`).bind(userId),
    ...items.map((item) =>
      db
        .prepare(
          `INSERT INTO subscriptions (id, user_id, name, category, currency, cost, start_date, billing_cycle, paused_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          item.id,
          userId,
          item.name,
          item.category,
          item.currency,
          item.cost,
          item.startDate,
          item.billingCycle,
          item.pausedAt ?? null
        )
    ),
  ];
  await db.batch(statements);
}
