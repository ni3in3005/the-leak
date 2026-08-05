import type { Subscription } from "@leak/shared";
import { cycleMonthsOf, fmtMoney, getCycleInfo, monthlyEquivalent } from "@leak/shared";

interface Props {
  subscriptions: Subscription[];
}

export function StatsStrip({ subscriptions }: Props) {
  let monthly = 0;
  let lifetime = 0;
  let biggest: { name: string; life: number; cur: string } | null = null;

  for (const s of subscriptions) {
    const info = getCycleInfo(s.startDate, cycleMonthsOf(s));
    monthly += monthlyEquivalent(s);
    const life = info.charges * Number(s.cost);
    lifetime += life;
    if (!biggest || life > biggest.life) {
      biggest = { name: s.name, life, cur: s.currency || "₹" };
    }
  }

  const n = subscriptions.length;

  return (
    <div className="stats">
      <div className="stat">
        <div className="label">Monthly burn</div>
        <div className="val">{n ? fmtMoney(monthly, "₹") : "—"}</div>
        <div className="foot">
          {n ? `across ${n} subscription${n > 1 ? "s" : ""}` : "nothing tracked yet"}
        </div>
      </div>
      <div className="stat">
        <div className="label">Spent so far, total</div>
        <div className="val leak">{n ? fmtMoney(lifetime, "₹") : "—"}</div>
        <div className="foot">{n ? "since you first subscribed" : "\u00a0"}</div>
      </div>
      <div className="stat">
        <div className="label">Active subscriptions</div>
        <div className="val">{n || "0"}</div>
        <div className="foot">{n ? "renewing on schedule" : "\u00a0"}</div>
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
