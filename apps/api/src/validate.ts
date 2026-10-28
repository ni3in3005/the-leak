import type { BillingCycle, Subscription, SubscriptionInput, SubscriptionsFile } from "@leak/shared";
import { CATEGORIES, newSubscriptionId } from "@leak/shared";

const CYCLES = new Set<BillingCycle>(["monthly", "yearly"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateField(
  value: unknown,
  fieldName: string
): string | null | { error: string } {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    return { error: `${fieldName} must be YYYY-MM-DD` };
  }
  return value;
}

export function parseSubscriptionInput(body: unknown): SubscriptionInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const category = typeof b.category === "string" ? b.category.trim() : "";
  const currency = typeof b.currency === "string" ? b.currency.trim() || "₹" : "₹";
  const cost = typeof b.cost === "number" ? b.cost : Number(b.cost);
  const startDate = typeof b.startDate === "string" ? b.startDate : "";
  const billingCycle = (typeof b.billingCycle === "string" ? b.billingCycle : "monthly") as BillingCycle;

  if (!name) return { error: "Name is required" };
  if (!category) return { error: "Category is required" };
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number]) && category !== "Other") {
    // Allow known categories; also accept Other already in list
  }
  if (!Number.isFinite(cost) || cost < 0) return { error: "Cost must be a non-negative number" };
  if (!DATE_RE.test(startDate)) return { error: "startDate must be YYYY-MM-DD" };
  if (!CYCLES.has(billingCycle)) return { error: "billingCycle must be monthly or yearly" };

  return { name, category, currency, cost, startDate, billingCycle };
}

export function normalizeImportedFile(raw: unknown): Subscription[] | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "JSON must be an object" };
  const file = raw as SubscriptionsFile;
  if (!Array.isArray(file.subscriptions)) {
    return { error: 'JSON must include a "subscriptions" array' };
  }

  const out: Subscription[] = [];
  for (const item of file.subscriptions) {
    if (!item || typeof item !== "object") continue;
    const parsed = parseSubscriptionInput(item);
    if ("error" in parsed) return { error: `Invalid subscription: ${parsed.error}` };
    const paused = parseDateField((item as Subscription).pausedAt, "pausedAt");
    if (paused && typeof paused === "object" && "error" in paused) {
      return { error: `Invalid subscription: ${paused.error}` };
    }
    if (paused && paused < parsed.startDate) {
      return { error: "Invalid subscription: pausedAt cannot be before startDate" };
    }
    const id =
      typeof (item as Subscription).id === "string" && (item as Subscription).id
        ? (item as Subscription).id
        : newSubscriptionId();
    out.push({ id, ...parsed, pausedAt: paused });
  }
  return out;
}
