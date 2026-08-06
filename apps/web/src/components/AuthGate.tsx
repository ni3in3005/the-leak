import {
  SignInButton,
  SignOutButton,
  SignedIn,
  SignedOut,
  UserButton,
  useUser,
} from "@clerk/clerk-react";
import type { Subscription, SubscriptionInput } from "@leak/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api";
import { useApiToken } from "../hooks/useApiToken";
import { CategoryChart } from "./CategoryChart";
import { StatsStrip } from "./StatsStrip";
import { SubscriptionCard } from "./SubscriptionCard";
import { SubscriptionModal } from "./SubscriptionModal";

export function Dashboard() {
  const { getAccessToken, isLoaded } = useApiToken();
  const { user } = useUser();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ text: string; error?: boolean } | null>(null);
  const [modalSub, setModalSub] = useState<Subscription | null | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showBanner = useCallback((text: string, error = false) => {
    setBanner({ text, error });
  }, []);

  const refresh = useCallback(async () => {
    const token = await getAccessToken();
    const { subscriptions: list } = await api.listSubscriptions(token);
    setSubscriptions(list);
    return list;
  }, [getAccessToken]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (e) {
        if (!cancelled) {
          showBanner(e instanceof Error ? e.message : "Failed to load subscriptions", true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, refresh, showBanner]);

  async function handleSave(input: SubscriptionInput) {
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (modalSub) {
        await api.updateSubscription(token, modalSub.id, input);
      } else {
        await api.createSubscription(token, input);
      }
      await refresh();
      setModalSub(undefined);
    } catch (e) {
      showBanner(e instanceof Error ? e.message : "Save failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!modalSub) return;
    setBusy(true);
    try {
      const token = await getAccessToken();
      await api.deleteSubscription(token, modalSub.id);
      await refresh();
      setModalSub(undefined);
    } catch (e) {
      showBanner(e instanceof Error ? e.message : "Delete failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    try {
      const token = await getAccessToken();
      const result = await api.exportSubscriptions(token);
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      showBanner(`Exported and backed up to R2 (${result.key})`);
    } catch (e) {
      showBanner(e instanceof Error ? e.message : "Export failed", true);
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { subscriptions?: unknown };
      if (!Array.isArray(parsed.subscriptions)) {
        throw new Error('JSON must include a "subscriptions" array');
      }
      const mode = confirm(
        "OK = replace all current subscriptions with this file.\nCancel = merge (add) onto existing."
      )
        ? "replace"
        : "merge";
      const token = await getAccessToken();
      const result = await api.importSubscriptions(
        token,
        parsed as { subscriptions: Subscription[] },
        mode
      );
      setSubscriptions(result.subscriptions);
      showBanner(`Imported (${mode}). Backup stored at ${result.key}`);
    } catch (e) {
      showBanner(e instanceof Error ? e.message : "Import failed", true);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="wrap">
      <header className="app-header">
        <div>
          <div className="eyebrow">Subscription meter</div>
          <h1>The Leak</h1>
          <div className="sub">
            Every recurring charge you signed up for and stopped opening. Watch what it&apos;s
            costing you, in real time.
          </div>
        </div>
        <div className="header-actions">
          <div className="file-status">
            <span className="dot on" />
            <span>Synced to cloud</span>
            <span className="user-chip">
              <UserButton afterSignOutUrl="/" />
              <SignOutButton>
                <button type="button" className="btn small ghost">
                  Sign out
                </button>
              </SignOutButton>
            </span>
          </div>
          <div className="header-buttons">
            <button
              type="button"
              className="btn small"
              disabled={busy}
              onClick={() => setModalSub(null)}
            >
              + Add subscription
            </button>
            <button type="button" className="btn small" disabled={busy} onClick={handleExport}>
              Export JSON
            </button>
            <button
              type="button"
              className="btn primary small"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportFile(f);
              }}
            />
          </div>
        </div>
      </header>

      {banner && (
        <div className={`banner ${banner.error ? "error" : ""}`}>
          {banner.text}
          <button
            type="button"
            className="btn small ghost"
            style={{ marginLeft: 12 }}
            onClick={() => setBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading your leaks…</div>
      ) : (
        <>
          <StatsStrip subscriptions={subscriptions} />
          <CategoryChart subscriptions={subscriptions} />
          {subscriptions.length === 0 ? (
            <>
              <div className="empty">
                <h2>Nothing tracked yet</h2>
                <p>Add the subscriptions that keep renewing quietly in the background.</p>
                {user?.primaryEmailAddress?.emailAddress && (
                  <p style={{ marginTop: 8, fontSize: 12 }}>
                    Signed in as {user.primaryEmailAddress.emailAddress}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="add-card"
                style={{ marginTop: 16 }}
                onClick={() => setModalSub(null)}
              >
                + Add subscription
              </button>
            </>
          ) : (
            <div className="grid">
              {subscriptions.map((s) => (
                <SubscriptionCard key={s.id} sub={s} onEdit={() => setModalSub(s)} />
              ))}
              <button type="button" className="add-card" onClick={() => setModalSub(null)}>
                + Add subscription
              </button>
            </div>
          )}
        </>
      )}

      <footer className="app-footer">
        Your data is stored in Cloudflare D1. JSON backups go to R2 when you export or import.
      </footer>

      {modalSub !== undefined && (
        <SubscriptionModal
          sub={modalSub}
          busy={busy}
          onClose={() => setModalSub(undefined)}
          onSave={handleSave}
          onDelete={modalSub ? handleDelete : undefined}
        />
      )}
    </div>
  );
}

export function AuthGate() {
  return (
    <>
      <SignedOut>
        <div className="auth-gate">
          <div className="auth-panel">
            <div className="eyebrow">Subscription meter</div>
            <h1>The Leak</h1>
            <div className="sub">
              Sign in to track every recurring charge and watch what it&apos;s costing you, in real
              time.
            </div>
            <SignInButton mode="modal">
              <button type="button" className="btn primary">
                Sign in to continue
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </>
  );
}
