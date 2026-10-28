import type { Subscription } from "@leak/shared";
import { useEffect, useState, type FormEvent } from "react";

interface Props {
  sub: Subscription;
  busy: boolean;
  onClose: () => void;
  onConfirm: (pausedAt: string) => Promise<void>;
}

export function PauseModal({ sub, busy, onClose, onConfirm }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [pausedAt, setPausedAt] = useState(() => sub.pausedAt || today);

  useEffect(() => {
    setPausedAt(sub.pausedAt || new Date().toISOString().slice(0, 10));
  }, [sub]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pausedAt) {
      alert("Please pick the date since when this subscription is paused.");
      return;
    }
    if (pausedAt < sub.startDate) {
      alert("Pause date cannot be before the start date.");
      return;
    }
    await onConfirm(pausedAt);
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={handleSubmit}>
        <h3>Pause {sub.name}</h3>
        <p className="modal-note">
          Tracking freezes on this date — spend stops ticking and it drops out of monthly burn.
        </p>
        <div className="field">
          <label>Paused since</label>
          <input
            type="date"
            value={pausedAt}
            min={sub.startDate}
            max={today}
            onChange={(e) => setPausedAt(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Pause"}
          </button>
        </div>
      </form>
    </div>
  );
}
