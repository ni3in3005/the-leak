import type { Subscription, SubscriptionInput, SubscriptionsFile } from "@leak/shared";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function apiFetch<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function listSubscriptions(token: string) {
  return apiFetch<{ subscriptions: Subscription[] }>("/api/subscriptions", token);
}

export function createSubscription(token: string, input: SubscriptionInput) {
  return apiFetch<{ subscription: Subscription }>("/api/subscriptions", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSubscription(token: string, id: string, input: SubscriptionInput) {
  return apiFetch<{ subscription: Subscription }>(`/api/subscriptions/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteSubscription(token: string, id: string) {
  return apiFetch<{ ok: boolean }>(`/api/subscriptions/${id}`, token, {
    method: "DELETE",
  });
}

export function seedDemo(token: string) {
  return apiFetch<{ seeded: boolean; subscriptions: Subscription[]; reason?: string }>(
    "/api/seed",
    token,
    { method: "POST" }
  );
}

export function exportSubscriptions(token: string) {
  return apiFetch<{ key: string; filename: string; data: SubscriptionsFile }>(
    "/api/export",
    token,
    { method: "POST" }
  );
}

export function importSubscriptions(
  token: string,
  file: SubscriptionsFile,
  mode: "replace" | "merge" = "replace"
) {
  return apiFetch<{ ok: boolean; key: string; mode: string; subscriptions: Subscription[] }>(
    "/api/import",
    token,
    {
      method: "POST",
      body: JSON.stringify({ ...file, mode }),
    }
  );
}
