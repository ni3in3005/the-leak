export type BillingCycle = "monthly" | "yearly";

export type Category = "AI Tool" | "OTT" | "Mobile/Internet" | "Other";

export const CATEGORIES: Category[] = [
  "AI Tool",
  "OTT",
  "Mobile/Internet",
  "Other",
];

export interface Subscription {
  id: string;
  name: string;
  category: Category | string;
  currency: string;
  cost: number;
  startDate: string;
  billingCycle: BillingCycle;
}

export interface SubscriptionsFile {
  subscriptions: Subscription[];
}

export interface SubscriptionInput {
  name: string;
  category: string;
  currency: string;
  cost: number;
  startDate: string;
  billingCycle: BillingCycle;
}

export interface CycleInfo {
  next: Date;
  prev: Date;
  charges: number;
  cycleDays: number;
  pct: number;
  remainingMs: number;
}
