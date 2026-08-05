import type { Subscription } from "@leak/shared";
import {
  computeLiveSpent,
  cycleMonthsOf,
  fmtCountdown,
  getCycleInfo,
} from "@leak/shared";
import { useEffect, useState } from "react";

const catClass: Record<string, string> = {
  "AI Tool": "ai",
  OTT: "ott",
  "Mobile/Internet": "mobile",
  Other: "",
};

const R = 34;
const CIRC = 2 * Math.PI * R;

interface Props {
  sub: Subscription;
  onEdit: () => void;
}

export function SubscriptionCard({ sub, onEdit }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const current = new Date(now);
  const info = getCycleInfo(sub.startDate, cycleMonthsOf(sub), current);
  const t = fmtCountdown(info.remainingMs);
  const live = computeLiveSpent(sub, current);
  const whole = Math.floor(live);
  const dec = (live - whole).toFixed(2).split(".")[1];
  const leakPerHour = Number(sub.cost) / (info.cycleDays * 24);
  const offset = CIRC * (1 - info.pct);
  const cur = sub.currency || "₹";

  return (
    <div className="card">
      <div className="card-top">
        <div>
          <span className={`cat-badge ${catClass[sub.category] || ""}`}>{sub.category}</span>
          <h3 className="name" style={{ marginTop: 8 }}>
            {sub.name}
          </h3>
        </div>
      </div>
      <div className="cost-line">
        {cur}
        {Number(sub.cost).toLocaleString("en-IN")} /{" "}
        {sub.billingCycle === "yearly" ? "year" : "month"}
      </div>
      <div className="gauge-row">
        <div className="gauge">
          <svg width="88" height="88" viewBox="0 0 88 88">
            <circle className="ring-bg" cx="44" cy="44" r={R} />
            <circle
              className="ring-fg"
              cx="44"
              cy="44"
              r={R}
              strokeDasharray={CIRC}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="gdays">
            <div className="n">{t.d}</div>
            <div className="u">days left</div>
          </div>
        </div>
        <div className="countdown">
          <b>{t.d}d</b> {String(t.h).padStart(2, "0")}h {String(t.m).padStart(2, "0")}m{" "}
          {String(t.sec).padStart(2, "0")}s
        </div>
      </div>
      <div className="spent-box">
        <div className="label">Spent since you subscribed</div>
        <div className="amount">
          <span className="whole">
            {cur}
            {whole.toLocaleString("en-IN")}
          </span>
          <span className="decimals">.{dec}</span>
        </div>
        <div className="rate">
          leaking {cur}
          {leakPerHour.toFixed(2)} / hour
        </div>
      </div>
      <div className="card-actions">
        <button type="button" className="btn small ghost" onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  );
}
