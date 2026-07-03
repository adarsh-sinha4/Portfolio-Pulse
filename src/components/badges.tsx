import type { RiskProfile } from "@/lib/types";

const RISK_STYLES: Record<RiskProfile, string> = {
  Conservative:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  Moderate:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
  Aggressive:
    "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20",
};

export function RiskBadge({ risk }: { risk: RiskProfile }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${RISK_STYLES[risk]}`}
    >
      {risk}
    </span>
  );
}

export function RebalanceBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="Portfolio has drifted more than 5pp from target in at least one asset class"
      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/30 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2 1 21h22L12 2zm0 6 6.5 11.5h-13L12 8zm-1 4v3h2v-3h-2zm0 4v2h2v-2h-2z" />
      </svg>
      {compact ? "Rebalance" : "Needs rebalancing"}
    </span>
  );
}
