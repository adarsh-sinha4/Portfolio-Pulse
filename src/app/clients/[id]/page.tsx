"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchPerformance, fetchPortfolio } from "@/lib/api";
import { loadOverride, saveOverride } from "@/lib/localStore";
import { portfolioAllocations, portfolioTotalValue } from "@/lib/portfolio";
import { formatINR, formatINRCompact, formatSignedPct } from "@/lib/format";
import type { PerformanceSeries, Portfolio } from "@/lib/types";
import { RebalanceBadge, RiskBadge } from "@/components/badges";
import { AllocationDonut } from "@/components/AllocationDonut";
import { PerformanceChart } from "@/components/PerformanceChart";
import { HoldingsTable } from "@/components/HoldingsTable";
import { RebalancePanel } from "@/components/RebalancePanel";
import { Card } from "@/components/Card";
import { ErrorState, Spinner } from "@/components/states";

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [performance, setPerformance] = useState<PerformanceSeries | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchPortfolio(id), fetchPerformance(id)])
      .then(([p, perf]) => {
        if (!active) return;
        setPortfolio(loadOverride(id) ?? p.portfolio);
        setPerformance(perf.performance);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id]);

  const allocations = useMemo(
    () => (portfolio ? portfolioAllocations(portfolio) : []),
    [portfolio],
  );

  if (error) return <ErrorState message={error} />;
  if (!portfolio) return <Spinner label="Loading portfolio…" />;

  const total = portfolioTotalValue(portfolio);
  const needsRebalance = allocations.some((a) => a.flagged);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          ← All clients
        </Link>
      </div>

      {/* Header / KPI strip */}
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-2 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{portfolio.name}</h1>
            <RiskBadge risk={portfolio.riskProfile} />
            {needsRebalance && <RebalanceBadge compact />}
          </div>
          <p className="text-sm text-ink-muted">
            {id.toUpperCase()} · {portfolio.holdings.length} holdings
          </p>
        </div>
        <div className="grid grid-cols-3 gap-5 sm:text-right">
          <Kpi label="AUM" value={formatINRCompact(total)} tooltip={formatINR(total)} />
          <Kpi label="1M return" value={formatSignedPct(portfolio.return1m)} tone={portfolio.return1m} />
          <Kpi label="YTD return" value={formatSignedPct(portfolio.returnYtd)} tone={portfolio.returnYtd} />
        </div>
      </div>

      {/* Allocation + performance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Asset allocation" subtitle="Current vs target">
          <AllocationDonut allocations={allocations} />
        </Card>
        <Card title="Performance" subtitle={`vs ${performance?.benchmarkName ?? "benchmark"}`}>
          {performance ? (
            <PerformanceChart series={performance} />
          ) : (
            <Spinner label="Loading performance…" />
          )}
        </Card>
      </div>

      {/* Rebalancing */}
      <Card
        title="Rebalancing engine"
        subtitle="Lot-level recommendations with every constraint surfaced"
      >
        <RebalancePanel
          portfolio={portfolio}
          onApplied={(updated) => {
            saveOverride(updated);
            setPortfolio(updated);
          }}
        />
      </Card>

      {/* Holdings */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Holdings</h2>
        <HoldingsTable portfolio={portfolio} />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  tooltip,
}: {
  label: string;
  value: string;
  tone?: number;
  tooltip?: string;
}) {
  const cls =
    tone === undefined
      ? ""
      : tone > 0
        ? "text-pos"
        : tone < 0
          ? "text-neg"
          : "text-ink-muted";
  return (
    <div title={tooltip}>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
