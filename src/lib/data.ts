/**
 * Authored mock dataset for Portfolio Pulse.
 *
 * Everything below is hand-authored (realistic Indian instruments, no lorem
 * ipsum). Holdings are specified by the ₹ value of each purchase lot at a chosen
 * price; units are derived (value / price) so the resulting current allocation
 * lands on the intended figures exactly. This lets the dataset deliberately
 * exercise the rebalancing engine:
 *
 *   • Aarav Mehta  — equities badly overweight; selling back to target burns
 *     through the LTCG / load-free lots and *must* reach a large recent equity-MF
 *     lot that is both STCG and exit-load-bearing. Two direct-equity positions
 *     are fully liquidated, so the holdings cap binds too. Debt is underweight,
 *     so a BUY is also produced.
 *   • Rohan Kapoor — gold overweight (a non-equity sell: no tax/load rules) and
 *     equities underweight (a buy). Confirms the engine treats non-equity
 *     classes correctly.
 *
 * The other five clients sit within the 5pp tolerance and should show no badge.
 */
import {
  type AssetClass,
  type Dataset,
  type Holding,
  type Lot,
  type PerformanceSeries,
  type Portfolio,
  type RiskProfile,
  type TargetAllocation,
} from "./types";
import { portfolioTotalValue } from "./portfolio";
import { BENCHMARK_NAME, VALUATION_DATE } from "./constants";

export { BENCHMARK_NAME, VALUATION_DATE };

interface LotSpec {
  date: string;
  value: number; // ₹ market value of this lot at `price`
}

let lotCounter = 0;

function buildHolding(
  id: string,
  instrumentName: string,
  assetClass: AssetClass,
  isEquityMutualFund: boolean,
  price: number,
  lots: LotSpec[],
): Holding {
  const builtLots: Lot[] = lots.map((l) => {
    lotCounter += 1;
    return {
      id: `${id}-lot${lotCounter}`,
      purchaseDate: l.date,
      units: round4(l.value / price),
      // Give each lot a plausible cost basis: a fraction of today's price so the
      // holdings table shows realistic gains. Older lots are cheaper.
      buyPrice: round4(price * costFactor(l.date)),
    };
  });
  return { id, instrumentName, assetClass, isEquityMutualFund, currentPrice: price, lots: builtLots };
}

/** Older purchase => lower cost basis (larger unrealised gain). Deterministic. */
function costFactor(purchaseDate: string): number {
  const years = (Date.parse(VALUATION_DATE) - Date.parse(purchaseDate)) / (365 * 864e5);
  // ~9% notional appreciation per year, capped so nothing looks absurd.
  return 1 / (1 + Math.min(years, 6) * 0.09);
}

function alloc(
  eq: number,
  debt: number,
  gold: number,
  re: number,
  alt: number,
): TargetAllocation {
  return {
    Equities: eq,
    Debt: debt,
    Gold: gold,
    "Real Estate": re,
    Alternatives: alt,
  };
}

function portfolio(
  id: string,
  name: string,
  riskProfile: RiskProfile,
  return1m: number,
  returnYtd: number,
  targetAllocation: TargetAllocation,
  holdings: Holding[],
): Portfolio {
  const p: Portfolio = {
    id,
    name,
    riskProfile,
    return1m,
    returnYtd,
    valuationDate: VALUATION_DATE,
    targetAllocation,
    holdings,
    aum: 0,
  };
  p.aum = Math.round(portfolioTotalValue(p));
  return p;
}

// --- Clients ---------------------------------------------------------------

const clients: Portfolio[] = [
  // 1) NEEDS REBALANCE: equity overweight (STCG + exit load + holdings cap), debt underweight.
  portfolio(
    "c1",
    "Aarav Mehta",
    "Aggressive",
    2.4,
    11.8,
    alloc(55, 25, 5, 8, 7),
    [
      buildHolding("c1-rel", "Reliance Industries Ltd", "Equities", false, 2900, [
        { date: "2023-03-10", value: 870000 }, // LTCG, direct equity (no load)
      ]),
      buildHolding("c1-hdfcb", "HDFC Bank Ltd", "Equities", false, 1650, [
        { date: "2022-11-05", value: 330000 }, // LTCG
      ]),
      buildHolding("c1-mirae", "Mirae Asset Large Cap Fund", "Equities", true, 110, [
        { date: "2024-01-20", value: 220000 }, // LTCG, load-free (> 365d)
        { date: "2026-02-15", value: 4400000 }, // STCG + 1% exit load (< 365d)
      ]),
      buildHolding("c1-hcbf", "HDFC Corporate Bond Fund", "Debt", false, 32, [
        { date: "2023-06-01", value: 931200 },
      ]),
      buildHolding("c1-goldetf", "Nippon India Gold ETF", "Gold", false, 62, [
        { date: "2023-08-14", value: 388000 },
      ]),
      buildHolding("c1-embassy", "Embassy Office Parks REIT", "Real Estate", false, 380, [
        { date: "2022-05-20", value: 310400 },
      ]),
      buildHolding("c1-indigrid", "IndiGrid InvIT", "Alternatives", false, 145, [
        { date: "2023-01-11", value: 310400 },
      ]),
    ],
  ),

  // 2) Balanced conservative.
  portfolio(
    "c2",
    "Diya Sharma",
    "Conservative",
    0.6,
    4.2,
    alloc(20, 55, 10, 10, 5),
    [
      buildHolding("c2-axis", "Axis Bluechip Fund", "Equities", true, 58, [
        { date: "2021-09-10", value: 2000000 },
      ]),
      buildHolding("c2-gilt", "SBI Magnum Gilt Fund", "Debt", false, 61, [
        { date: "2022-02-01", value: 3000000 },
      ]),
      buildHolding("c2-hcbf", "HDFC Corporate Bond Fund", "Debt", false, 32, [
        { date: "2022-04-18", value: 2500000 },
      ]),
      buildHolding("c2-sgb", "Sovereign Gold Bond 2031", "Gold", false, 7200, [
        { date: "2023-03-03", value: 1000000 },
      ]),
      buildHolding("c2-mindspace", "Mindspace Business Parks REIT", "Real Estate", false, 355, [
        { date: "2022-07-22", value: 1000000 },
      ]),
      buildHolding("c2-powergrid", "PowerGrid InvIT", "Alternatives", false, 98, [
        { date: "2023-05-30", value: 500000 },
      ]),
    ],
  ),

  // 3) NEEDS REBALANCE: gold overweight (non-equity sell), equities underweight (buy).
  portfolio(
    "c3",
    "Rohan Kapoor",
    "Moderate",
    1.1,
    7.5,
    alloc(50, 25, 5, 12, 8),
    [
      buildHolding("c3-hdfcb", "HDFC Bank Ltd", "Equities", false, 1650, [
        { date: "2021-12-15", value: 4000000 },
      ]),
      buildHolding("c3-ppfc", "Parag Parikh Flexi Cap Fund", "Equities", true, 82, [
        { date: "2022-06-08", value: 4000000 },
      ]),
      buildHolding("c3-icicibond", "ICICI Prudential Short Term Fund", "Debt", false, 56, [
        { date: "2022-10-12", value: 4800000 },
      ]),
      buildHolding("c3-goldetf", "Nippon India Gold ETF", "Gold", false, 62, [
        { date: "2021-05-19", value: 1500000 }, // older gold lot
        { date: "2024-11-02", value: 1300000 }, // newer gold lot (still non-equity: no load/STCG)
      ]),
      buildHolding("c3-brookfield", "Brookfield India REIT", "Real Estate", false, 300, [
        { date: "2022-09-01", value: 2800000 },
      ]),
      buildHolding("c3-indigrid", "IndiGrid InvIT", "Alternatives", false, 145, [
        { date: "2023-02-27", value: 1600000 },
      ]),
    ],
  ),

  // 4) Balanced aggressive.
  portfolio(
    "c4",
    "Ananya Reddy",
    "Aggressive",
    3.1,
    14.6,
    alloc(65, 10, 5, 10, 10),
    [
      buildHolding("c4-infy", "Infosys Ltd", "Equities", false, 1600, [
        { date: "2021-04-12", value: 12000000 },
      ]),
      buildHolding("c4-sbismall", "SBI Small Cap Fund", "Equities", true, 175, [
        { date: "2022-08-19", value: 11450000 },
      ]),
      buildHolding("c4-hcbf", "HDFC Corporate Bond Fund", "Debt", false, 32, [
        { date: "2023-01-09", value: 3150000 },
      ]),
      buildHolding("c4-sgb", "Sovereign Gold Bond 2031", "Gold", false, 7200, [
        { date: "2022-11-11", value: 1750000 },
      ]),
      buildHolding("c4-embassy", "Embassy Office Parks REIT", "Real Estate", false, 380, [
        { date: "2022-03-15", value: 3500000 },
      ]),
      buildHolding("c4-indigrid", "IndiGrid InvIT", "Alternatives", false, 145, [
        { date: "2023-07-01", value: 3150000 },
      ]),
    ],
  ),

  // 5) Balanced moderate.
  portfolio(
    "c5",
    "Vikram Singh",
    "Moderate",
    1.7,
    8.9,
    alloc(45, 30, 10, 10, 5),
    [
      buildHolding("c5-tcs", "Tata Consultancy Services Ltd", "Equities", false, 3850, [
        { date: "2021-10-05", value: 4320000 },
      ]),
      buildHolding("c5-mirae", "Mirae Asset Large Cap Fund", "Equities", true, 110, [
        { date: "2022-12-01", value: 2880000 },
      ]),
      buildHolding("c5-gilt", "SBI Magnum Gilt Fund", "Debt", false, 61, [
        { date: "2022-05-05", value: 4200000 },
      ]),
      buildHolding("c5-goldetf", "Nippon India Gold ETF", "Gold", false, 62, [
        { date: "2023-04-20", value: 1440000 },
      ]),
      buildHolding("c5-mindspace", "Mindspace Business Parks REIT", "Real Estate", false, 355, [
        { date: "2022-06-14", value: 1440000 },
      ]),
      buildHolding("c5-powergrid", "PowerGrid InvIT", "Alternatives", false, 98, [
        { date: "2023-09-22", value: 720000 },
      ]),
    ],
  ),

  // 6) Balanced conservative.
  portfolio(
    "c6",
    "Ishaan Gupta",
    "Conservative",
    0.4,
    3.6,
    alloc(15, 60, 15, 5, 5),
    [
      buildHolding("c6-axis", "Axis Bluechip Fund", "Equities", true, 58, [
        { date: "2021-11-30", value: 1200000 },
      ]),
      buildHolding("c6-gilt", "SBI Magnum Gilt Fund", "Debt", false, 61, [
        { date: "2022-01-15", value: 2800000 },
      ]),
      buildHolding("c6-icicibond", "ICICI Prudential Short Term Fund", "Debt", false, 56, [
        { date: "2022-03-28", value: 2000000 },
      ]),
      buildHolding("c6-sgb", "Sovereign Gold Bond 2031", "Gold", false, 7200, [
        { date: "2022-09-09", value: 1200000 },
      ]),
      buildHolding("c6-embassy", "Embassy Office Parks REIT", "Real Estate", false, 380, [
        { date: "2023-02-11", value: 400000 },
      ]),
      buildHolding("c6-powergrid", "PowerGrid InvIT", "Alternatives", false, 98, [
        { date: "2023-06-06", value: 400000 },
      ]),
    ],
  ),

  // 7) Balanced aggressive (holds a recent equity-MF lot for table variety, but
  //    allocation is within tolerance so no badge).
  portfolio(
    "c7",
    "Meera Iyer",
    "Aggressive",
    2.8,
    12.3,
    alloc(60, 15, 5, 10, 10),
    [
      buildHolding("c7-rel", "Reliance Industries Ltd", "Equities", false, 2900, [
        { date: "2021-07-19", value: 8000000 },
      ]),
      buildHolding("c7-ppfc", "Parag Parikh Flexi Cap Fund", "Equities", true, 82, [
        { date: "2020-10-14", value: 4000000 }, // LTCG
        { date: "2026-03-01", value: 1640000 }, // recent STCG + exit load lot (not needed for rebalance)
      ]),
      buildHolding("c7-hcbf", "HDFC Corporate Bond Fund", "Debt", false, 32, [
        { date: "2022-08-08", value: 3080000 },
      ]),
      buildHolding("c7-sgb", "Sovereign Gold Bond 2031", "Gold", false, 7200, [
        { date: "2023-01-25", value: 1100000 },
      ]),
      buildHolding("c7-brookfield", "Brookfield India REIT", "Real Estate", false, 300, [
        { date: "2022-04-04", value: 2200000 },
      ]),
      buildHolding("c7-indigrid", "IndiGrid InvIT", "Alternatives", false, 145, [
        { date: "2023-03-19", value: 2200000 },
      ]),
    ],
  ),
];

// --- Performance series (6 months, date-aligned portfolio vs benchmark) -----

/** Deterministic pseudo-random in [0,1) from an integer seed. */
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 27 weekly points ending on the valuation date, indexed to 100 at the start.
 *  Portfolio and benchmark share the exact same date axis. */
function buildPerformance(client: Portfolio): PerformanceSeries {
  const rand = seeded(hash(client.id));
  const end = new Date(VALUATION_DATE);
  const weeks = 26;
  const points = [] as PerformanceSeries["points"];
  let pfIndex = 100;
  let bmIndex = 100;
  // Nudge the drift so the portfolio finishes roughly in line with its YTD sign.
  const pfBias = client.returnYtd >= 8 ? 0.0016 : 0.0009;
  const bmBias = 0.001;
  for (let i = weeks; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i * 7);
    if (i !== weeks) {
      pfIndex *= 1 + pfBias + (rand() - 0.5) * 0.02;
      bmIndex *= 1 + bmBias + (rand() - 0.5) * 0.018;
    }
    points.push({
      date: isoDate(d),
      portfolio: Math.round(pfIndex * 100) / 100,
      benchmark: Math.round(bmIndex * 100) / 100,
    });
  }
  return { clientId: client.id, benchmarkName: BENCHMARK_NAME, points };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) + 1;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export const dataset: Dataset = {
  valuationDate: VALUATION_DATE,
  benchmarkName: BENCHMARK_NAME,
  clients,
};

export const performanceByClient: Record<string, PerformanceSeries> = Object.fromEntries(
  clients.map((c) => [c.id, buildPerformance(c)]),
);

export function getClient(id: string): Portfolio | undefined {
  return dataset.clients.find((c) => c.id === id);
}
