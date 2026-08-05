import type { Subscription } from "@leak/shared";
import { computeLiveSpent } from "@leak/shared";
import { useEffect, useMemo, useState } from "react";

interface Props {
  subscriptions: Subscription[];
}

export function CategoryChart({ subscriptions }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    const groups: Record<string, { amt: number; cur: string }> = {};
    const current = new Date(now);
    for (const s of subscriptions) {
      const amt = computeLiveSpent(s, current);
      const cur = s.currency || "₹";
      if (!groups[s.category]) groups[s.category] = { amt: 0, cur };
      groups[s.category].amt += amt;
    }
    return Object.keys(groups)
      .map((name) => ({ name, cur: groups[name].cur, amt: groups[name].amt }))
      .sort((a, b) => b.amt - a.amt);
  }, [subscriptions, now]);

  if (!subscriptions.length) return null;
  const max = rows[0]?.amt || 1;

  return (
    <div className="chart-panel">
      <div className="label">Spend by category</div>
      {rows.map((r) => (
        <div className="chart-row" key={r.name}>
          <div className="chart-name" title={r.name}>
            {r.name}
          </div>
          <div className="chart-bar-track">
            <div
              className="chart-bar-fill"
              style={{ width: `${max ? (r.amt / max) * 100 : 0}%` }}
            />
          </div>
          <div className="chart-amt">
            {r.cur}
            {Math.round(r.amt).toLocaleString("en-IN")}
          </div>
        </div>
      ))}
    </div>
  );
}
