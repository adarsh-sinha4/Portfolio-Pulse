"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchClients } from "@/lib/api";
import { loadOverride } from "@/lib/localStore";
import { summaryNeedsRebalancing } from "@/lib/portfolio";
import { toSummary } from "@/lib/summary";
import { formatINRCompact, formatSignedPct } from "@/lib/format";
import { RISK_ORDER, type ClientSummary, type RiskProfile } from "@/lib/types";
import { RebalanceBadge, RiskBadge } from "@/components/badges";
import { ErrorState, Spinner } from "@/components/states";

type SortKey = "aum" | "return1m" | "risk";
type SortDir = "asc" | "desc";
type RiskFilter = RiskProfile | "All";

interface Row extends ClientSummary {
  needsRebalance: boolean;
}

export default function OverviewPage() {
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("aum");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("All");

  useEffect(() => {
    let active = true;
    fetchClients()
      .then((d) => {
        if (!active) return;
        const merged = d.clients.map((c) => {
          const override = loadOverride(c.id);
          return override ? toSummary(override) : c;
        });
        setClients(merged);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (!clients) return [];
    const enriched: Row[] = clients.map((c) => ({
      ...c,
      // The overview derives the badge itself from current-vs-target allocation.
      needsRebalance: summaryNeedsRebalancing(c.currentAllocation, c.targetAllocation),
    }));
    const filtered =
      riskFilter === "All" ? enriched : enriched.filter((c) => c.riskProfile === riskFilter);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "risk") {
        return (RISK_ORDER.indexOf(a.riskProfile) - RISK_ORDER.indexOf(b.riskProfile)) * dir;
      }
      return (a[sortKey] - b[sortKey]) * dir;
    });
  }, [clients, sortKey, sortDir, riskFilter]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "risk" ? "asc" : "desc");
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!clients) return <Spinner label="Loading client book…" />;

  const flaggedCount = rows.filter((r) => r.needsRebalance).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Client portfolios</h1>
        <p className="text-sm text-ink-muted">
          {rows.length} client{rows.length === 1 ? "" : "s"}
          {flaggedCount > 0 && (
            <>
              {" · "}
              <span className="font-medium text-warn">{flaggedCount} need rebalancing</span>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterGroup value={riskFilter} onChange={setRiskFilter} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface-2">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3 font-medium">Client</th>
              <SortHeader
                label="AUM"
                active={sortKey === "aum"}
                dir={sortDir}
                onClick={() => toggleSort("aum")}
                align="right"
              />
              <SortHeader
                label="1M return"
                active={sortKey === "return1m"}
                dir={sortDir}
                onClick={() => toggleSort("return1m")}
                align="right"
              />
              <th className="px-4 py-3 text-right font-medium">YTD</th>
              <SortHeader
                label="Risk"
                active={sortKey === "risk"}
                dir={sortDir}
                onClick={() => toggleSort("risk")}
                align="left"
              />
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr
                key={c.id}
                className="group border-b border-line last:border-0 transition-colors hover:bg-surface"
              >
                <td className="px-4 py-3">
                  <Link href={`/clients/${c.id}`} className="block">
                    <div className="font-medium group-hover:text-brand">{c.name}</div>
                    <div className="text-xs text-ink-muted">{c.id.toUpperCase()}</div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatINRCompact(c.aum)}</td>
                <td className="px-4 py-3 text-right">
                  <ReturnCell value={c.return1m} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ReturnCell value={c.returnYtd} />
                </td>
                <td className="px-4 py-3">
                  <RiskBadge risk={c.riskProfile} />
                </td>
                <td className="px-4 py-3">
                  {c.needsRebalance ? (
                    <RebalanceBadge compact />
                  ) : (
                    <span className="text-xs text-ink-muted">On target</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReturnCell({ value }: { value: number }) {
  const cls = value > 0 ? "text-pos" : value < 0 ? "text-neg" : "text-ink-muted";
  return <span className={`font-medium ${cls}`}>{formatSignedPct(value)}</span>;
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align: "left" | "right";
}) {
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-ink ${
          active ? "text-ink" : ""
        }`}
      >
        {label}
        <span className="text-[10px]">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function FilterGroup({
  value,
  onChange,
}: {
  value: RiskFilter;
  onChange: (v: RiskFilter) => void;
}) {
  const options: RiskFilter[] = ["All", ...RISK_ORDER];
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt
              ? "bg-brand text-white"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
