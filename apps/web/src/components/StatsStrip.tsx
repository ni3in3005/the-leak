import type { Subscription } from "@leak/shared";
import {
  computeLiveSpent,
  fmtMoney,
  isPaused,
  monthlyEquivalent,
} from "@leak/shared";

interface Props {
  subscriptions: Subscription[];
}

export function StatsStrip({ subscriptions }: Props) {
  let monthly = 0;
  let lifetime = 0;
  let biggest: { name: string; life: number; cur: string } | null = null;
  let active = 0;

  for (const s of subscriptions) {
    if (!isPaused(s)) {
      active += 1;
      monthly += monthlyEquivalent(s);
    }
    const life = computeLiveSpent(s);
    lifetime += life;
    if (!biggest || life > biggest.life) {
      biggest = { name: s.name, life, cur: s.currency || "₹" };
    }
  }

  const n = subscriptions.length;
  const paused = n - active;

  return (
    <div className="stats">
      <div className="stat">
        <div className="label">Monthly burn</div>
        <div className="val">{n ? fmtMoney(monthly, "₹") : "—"}</div>
        <div className="foot">
          {n
            ? `across ${active} active subscription${active === 1 ? "" : "s"}`
            : "nothing tracked yet"}
        </div>
      </div>
      <div className="stat">
        <div className="label">Spent so far, total</div>
        <div className="val leak">{n ? fmtMoney(lifetime, "₹") : "—"}</div>
        <div className="foot">{n ? "since you first subscribed" : "\u00a0"}</div>
      </div>
      <div className="stat">
        <div className="label">Active subscriptions</div>
        <div className="val">{n ? String(active) : "0"}</div>
        <div className="foot">
          {n ? (paused ? `${paused} paused` : "renewing on schedule") : "\u00a0"}
        </div>
      </div>
      <div className="stat">
        <div className="label">Biggest leak</div>
        <div className="val biggest">{biggest ? biggest.name : "—"}</div>
        <div className="foot">
          {biggest ? `${fmtMoney(biggest.life, biggest.cur)} spent on it` : "\u00a0"}
        </div>
      </div>
    </div>
  );
}
