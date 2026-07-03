"use client";

import { useMemo, useState } from "react";
import { generateRebalancePlan } from "@/lib/rebalance";
import { applyRebalance, resetPortfolio } from "@/lib/api";
import { formatINR, formatUnits } from "@/lib/format";
import type { Portfolio, RebalanceAction } from "@/lib/types";
import { CLASS_COLORS } from "./AllocationDonut";

interface Props {
  portfolio: Portfolio;
  /** Called with the server's updated portfolio after apply / reset. */
  onApplied: (updated: Portfolio) => void;
}

export function RebalancePanel({ portfolio, onApplied }: Props) {
  const plan = useMemo(() => generateRebalancePlan(portfolio), [portfolio]);
  const [busy, setBusy] = useState<null | "apply" | "reset">(null);
  const [error, setError] = useState<string | null>(null);

  const sells = plan.actions.filter((a) => a.type === "SELL");
  const buys = plan.actions.filter((a) => a.type === "BUY");
  const totalSell = sells.reduce((s, a) => s + a.estimatedValue, 0);
  const totalBuy = buys.reduce((s, a) => s + a.estimatedValue, 0);
  const totalLoad = sells.reduce((s, a) => s + (a.totalExitLoad ?? 0), 0);

  async function onApply() {
    setBusy("apply");
    setError(null);
    try {
      const { portfolio: updated } = await applyRebalance(portfolio.id, plan.actions);
      onApplied(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onReset() {
    setBusy("reset");
    setError(null);
    try {
      const { portfolio: updated } = await resetPortfolio(portfolio.id);
      onApplied(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!plan.needsRebalancing) {
    return (
      <div className="rounded-xl border border-line bg-surface-2 p-5">
        <div className="flex items-center gap-2">
          <CheckIcon />
          <p className="text-sm font-medium">Allocation is within tolerance</p>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Every asset class is within 5 percentage points of its target. No rebalancing is
          recommended.
        </p>
        <ResetRow busy={busy} onReset={onReset} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-sm dark:border-amber-400/20 dark:bg-amber-500/10">
        <p className="font-medium text-amber-800 dark:text-amber-200">
          Rebalancing recommended
        </p>
        <p className="mt-1 text-amber-700/90 dark:text-amber-200/80">
          Sell {formatINR(totalSell)} and buy {formatINR(totalBuy)} across {plan.actions.length}{" "}
          action{plan.actions.length === 1 ? "" : "s"} to bring flagged classes back toward target.
          {totalLoad > 0 && (
            <>
              {" "}
              Estimated exit load: <span className="font-semibold">{formatINR(totalLoad)}</span>.
            </>
          )}
        </p>
      </div>

      {sells.length > 0 && (
        <Section title="Sell">
          {sells.map((a) => (
            <ActionCard key={a.id} action={a} />
          ))}
        </Section>
      )}

      {buys.length > 0 && (
        <Section title="Buy">
          {buys.map((a) => (
            <ActionCard key={a.id} action={a} />
          ))}
        </Section>
      )}

      {error && <p className="text-sm text-neg">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onApply}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy === "apply" ? "Applying…" : "Apply rebalance"}
        </button>
        <ResetRow busy={busy} onReset={onReset} inline />
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: RebalanceAction }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ background: CLASS_COLORS[action.assetClass] }}
          />
          <div>
            <div className="font-medium">{action.instrumentName}</div>
            <div className="text-xs text-ink-muted">{action.assetClass}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums">
            {action.type === "SELL" ? "−" : "+"}
            {formatUnits(action.units)} units
          </div>
          <div className="text-xs text-ink-muted tabular-nums">{formatINR(action.estimatedValue)}</div>
        </div>
      </div>

      {action.constraints.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {action.constraints.map((c, i) => (
            <ConstraintTag key={i} text={c} />
          ))}
        </div>
      )}

      {action.lotSales && action.lotSales.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-md border border-line">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-2 text-left text-ink-muted">
                <th className="px-2 py-1.5 font-medium">Lot</th>
                <th className="px-2 py-1.5 font-medium">Purchased</th>
                <th className="px-2 py-1.5 text-right font-medium">Held</th>
                <th className="px-2 py-1.5 text-right font-medium">Units</th>
                <th className="px-2 py-1.5 text-right font-medium">Value</th>
                <th className="px-2 py-1.5 font-medium">Tax</th>
                <th className="px-2 py-1.5 font-medium">Exit load</th>
              </tr>
            </thead>
            <tbody>
              {action.lotSales.map((ls) => (
                <tr key={ls.lotId} className="border-t border-line">
                  <td className="px-2 py-1.5 font-mono text-[11px] text-ink-muted">
                    {ls.lotId.split("-lot").pop()}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{ls.purchaseDate}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{ls.holdingDays}d</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatUnits(ls.units)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatINR(ls.redemptionValue)}</td>
                  <td className="px-2 py-1.5">
                    {ls.classification === "N/A" ? (
                      <span className="text-ink-muted">—</span>
                    ) : (
                      <span
                        className={
                          ls.classification === "LTCG" ? "text-pos" : "text-warn"
                        }
                      >
                        {ls.classification}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {ls.exitLoad ? (
                      <span className="text-neg">1% · {formatINR(ls.exitLoadAmount)}</span>
                    ) : (
                      <span className="text-ink-muted">none</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConstraintTag({ text }: { text: string }) {
  const isWarn = text.startsWith("⚠");
  const isCap = text.startsWith("Holdings cap");
  const cls = isWarn
    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
    : isCap
      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
      : "bg-surface-2 text-ink-muted";
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${cls}`}>{text}</span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ResetRow({
  busy,
  onReset,
  inline = false,
}: {
  busy: null | "apply" | "reset";
  onReset: () => void;
  inline?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onReset}
      disabled={busy !== null}
      className={`text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50 ${
        inline ? "" : "mt-3"
      }`}
    >
      {busy === "reset" ? "Resetting…" : "Reset to original"}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--pos))" strokeWidth="2.5" className="text-pos">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
