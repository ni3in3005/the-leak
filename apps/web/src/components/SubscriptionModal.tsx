import type { BillingCycle, Category, Subscription } from "@leak/shared";
import { CATEGORIES } from "@leak/shared";
import { useEffect, useState, type FormEvent } from "react";

interface Props {
  sub: Subscription | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    name: string;
    category: string;
    currency: string;
    cost: number;
    startDate: string;
    billingCycle: BillingCycle;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function SubscriptionModal({ sub, busy, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("AI Tool");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [currency, setCurrency] = useState("₹");
  const [cost, setCost] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setName(sub?.name ?? "");
    setCategory(sub?.category ?? "AI Tool");
    setBillingCycle(sub?.billingCycle ?? "monthly");
    setCurrency(sub?.currency ?? "₹");
    setCost(sub ? String(sub.cost) : "");
    setStartDate(sub?.startDate ?? new Date().toISOString().slice(0, 10));
  }, [sub]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedCost = parseFloat(cost);
    if (!name.trim() || Number.isNaN(parsedCost) || !startDate) {
      alert("Please fill in name, cost, and start date.");
      return;
    }
    await onSave({
      name: name.trim(),
      category,
      currency: currency.trim() || "₹",
      cost: parsedCost,
      startDate,
      billingCycle,
    });
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={handleSubmit}>
        <h3>{sub ? "Edit subscription" : "Add subscription"}</h3>
        <div className="field">
          <label>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ChatGPT Plus"
            autoFocus
          />
        </div>
        <div className="row2">
          <div className="field">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c: Category) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Billing cycle</label>
            <select
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label>Currency</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={3}
            />
          </div>
          <div className="field">
            <label>{billingCycle === "yearly" ? "Yearly cost" : "Monthly cost"}</label>
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="1999"
              min={0}
              step="0.01"
            />
          </div>
        </div>
        <div className="field">
          <label>First charged on</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          {sub && onDelete && (
            <button
              type="button"
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                if (!confirm("Delete this subscription? This only removes it from tracking here.")) {
                  return;
                }
                await onDelete();
              }}
            >
              Delete
            </button>
          )}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
