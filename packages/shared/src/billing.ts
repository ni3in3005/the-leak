import type { BillingCycle, CycleInfo, Subscription } from "./types.js";

export function cycleMonthsOf(s: Pick<Subscription, "billingCycle"> | BillingCycle): number {
  const cycle = typeof s === "string" ? s : s.billingCycle;
  return cycle === "yearly" ? 12 : 1;
}

export function isPaused(s: Pick<Subscription, "pausedAt">): boolean {
  return Boolean(s.pausedAt);
}

/** When paused, freeze calculations at the pause date (end of that day). */
export function effectiveNow(
  s: Pick<Subscription, "pausedAt">,
  now = new Date()
): Date {
  if (s.pausedAt) {
    return new Date(s.pausedAt + "T23:59:59");
  }
  return now;
}

export function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export function monthsSinceStart(start: Date, now: Date): number {
  return (
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth())
  );
}

export function getCycleInfo(startStr: string, cycleMonths = 1, now = new Date()): CycleInfo {
  const start = new Date(startStr + "T00:00:00");
  let m = monthsSinceStart(start, now);
  if (m < 0) m = 0;
  let k = Math.floor(m / cycleMonths);
  let anchor = addMonthsClamped(start, k * cycleMonths);
  let prev: Date;
  let next: Date;
  let charges: number;
  if (anchor <= now) {
    prev = anchor;
    next = addMonthsClamped(start, (k + 1) * cycleMonths);
    charges = k + 1;
  } else {
    prev = addMonthsClamped(start, (k - 1) * cycleMonths);
    next = anchor;
    charges = k;
  }
  if (charges < 1) charges = 1;
  const cycleDays = Math.max(1, Math.round((next.getTime() - prev.getTime()) / 86400000));
  const elapsedMs = now.getTime() - prev.getTime();
  const totalMs = next.getTime() - prev.getTime();
  const pct = Math.min(1, Math.max(0, elapsedMs / totalMs));
  return { next, prev, charges, cycleDays, pct, remainingMs: next.getTime() - now.getTime() };
}

export function computeLiveSpent(
  s: Pick<Subscription, "startDate" | "billingCycle" | "cost" | "pausedAt">,
  now = new Date()
): number {
  const asOf = effectiveNow(s, now);
  const info = getCycleInfo(s.startDate, cycleMonthsOf(s), asOf);
  const elapsedInCycle = info.cycleDays * 86400 * 1000 - info.remainingMs;
  const fractionCost = (elapsedInCycle / 1000) * (Number(s.cost) / (info.cycleDays * 86400));
  const baseCharges = info.charges - 1;
  return baseCharges * Number(s.cost) + fractionCost;
}

export function monthlyEquivalent(
  s: Pick<Subscription, "billingCycle" | "cost" | "pausedAt">
): number {
  if (isPaused(s)) return 0;
  return s.billingCycle === "yearly" ? Number(s.cost) / 12 : Number(s.cost);
}

export function fmtMoney(v: number, cur: string): string {
  return cur + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function fmtCountdown(ms: number): { d: number; h: number; m: number; sec: number } {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return { d, h, m, sec };
}

export function newSubscriptionId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
