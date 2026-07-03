# Portfolio Pulse

An internal dashboard for Relationship Managers (RMs) at a private wealth firm to
monitor High Net Worth Individual (HNI) portfolios and — the centrepiece — run a
**lot-level rebalancing engine** that respects real-world constraints (holdings
cap, exit load, STCG/LTCG classification) and surfaces every one of them visibly.

Currency is Indian Rupee (₹) throughout. All figures are as of a fixed
`valuationDate` (2026-06-30) so results are deterministic.

---

## Running it locally

Requires Node 18.17+ (Node 20+ recommended).

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run test       # Vitest unit tests for the rebalancing engine + store
npm run typecheck  # tsc --noEmit, strict
npm run build      # production build
npx tsx scripts/verify.ts   # prints every client's drift + rebalance plan to the console
```

One command after install (`npm run dev`) boots both the UI and the mock API —
the backend is implemented as Next.js API routes, so there is nothing else to
start. No paid or external services are used.

---

## What's here

- **Client overview** (`/`) — every client as a sortable, filterable row: AUM,
  1-month and YTD return, risk profile, and a **rebalance badge that the overview
  derives itself** from the current-vs-target allocation in the client summary
  (it is not handed to the UI by the API). Sortable by AUM, 1-month return, or
  risk (risk sorts Conservative → Moderate → Aggressive, not alphabetically);
  filterable by risk profile.
- **Portfolio detail** (`/clients/[id]`) — asset-allocation donut (current % vs
  target % per class with signed drift), a holdings table whose current value,
  gain/loss and weight are **all derived** from lots (units, price, cost basis),
  a 6-month portfolio-vs-Nifty performance chart on a shared date axis, and the
  rebalancing panel.
- **Rebalancing panel** — per-instrument buy/sell recommendations, each showing
  the constraints that apply to it, with a lot-by-lot breakdown (held days,
  units, STCG/LTCG label, exit load). **Apply rebalance** POSTs the actions to
  the API and the UI re-renders from the server's updated allocation. A "reset"
  restores the authored state so the demo is repeatable.

---

## Stack, and why

| Choice | Why |
| --- | --- |
| **Next.js (App Router)** | One repo, one command. API routes give a real HTTP data boundary (the mock backend) without a second process, and server components keep the shell lean. |
| **TypeScript, strict** | Required. Also `noUncheckedIndexedAccess` and `noUnusedLocals` — the domain model is the thing that makes the rebalancing rules expressible, so the types earn their keep. |
| **Recharts** | The charts here are a donut and a two-line time series — both first-class in Recharts with almost no code, and it themes cleanly via CSS variables for dark mode. D3 would be more power than this needs; Chart.js is canvas (harder to style to the token system). The viz is deliberately *readable and labelled*, not decorative. |
| **Tailwind + CSS variables** | A small semantic palette (`surface` / `ink` / `line` / `brand`) defined once as CSS variables and flipped for `.dark`. Components never reference raw colours, so dark mode is a single source of truth. |
| **Vitest** | Fast, zero-config for a TS library, and the engine is pure functions — ideal to unit test. |
| **State** | Deliberately no state library. Server state is fetched per view through a thin `lib/api.ts`; view state (sort/filter, applied portfolio) is local `useState`. Adding Redux/Zustand here would be over-engineering. |

---

## Architecture

```
src/
  lib/
    types.ts        # domain model — Lot → Holding → Portfolio
    data.ts         # authored mock dataset (7 clients) + performance series
    portfolio.ts    # pure derivations: current value, allocation, weights, drift
    rebalance.ts    # THE ENGINE — lot-level buy/sell with all constraints
    store.ts        # in-memory server state for apply/reset
    summary.ts      # overview summary (AUM + current-vs-target allocation)
    api.ts          # client-side fetchers (the only way components get data)
    format.ts       # ₹ / % / units / date formatting (Indian grouping)
  app/
    api/clients/...            # the four endpoints
    page.tsx                   # overview (smart container)
    clients/[id]/page.tsx      # detail (smart container)
  components/                  # presentational: donut, chart, tables, panel, badges
```

**Smart vs presentational.** The two `page.tsx` containers own data fetching,
loading/error states, and the sort/filter/apply state. Everything in
`components/` is presentational and takes plain props — `AllocationDonut`,
`PerformanceChart`, `HoldingsTable`, and `RebalancePanel` don't know where their
data came from, which keeps them reusable and trivially testable.

**Derivation lives in one place.** `portfolio.ts` is pure and imported by *both*
the API/engine and the browser. The API returns raw holdings and lots; current
allocation and weights are derived on the client from the same functions the
engine uses, so the badge on the overview, the donut on the detail page, and the
engine can never disagree.

### API

| Endpoint | Returns |
| --- | --- |
| `GET /api/clients` | Client summaries: AUM (derived), pre-computed 1M/YTD returns, risk, and current-vs-target allocation so the overview derives its own badge. |
| `GET /api/clients/:id/portfolio` | Full portfolio: holdings, purchase lots, target allocation. |
| `GET /api/clients/:id/performance` | Date-aligned portfolio and benchmark series. |
| `POST /api/clients/:id/rebalance` | Applies `{ actions }` (or `{ reset: true }`) and returns the updated portfolio. |

Loading and error states are handled in the containers (`Spinner` / `ErrorState`),
and every fetch is `no-store` so applying a rebalance is reflected immediately.

---

## The rebalancing engine — how each constraint is handled

All of this lives in `src/lib/rebalance.ts` and is exercised by
`src/lib/rebalance.test.ts`.

**1. Drift detection.** For each class, `driftPct = currentPct − targetPct`. A
class is flagged only when `|driftPct| > 5`. Exactly 5pp is *within* tolerance
(there's a test for the boundary). Overweight → sell; underweight → buy.

**2. Lot-level reasoning.** The atomic unit in the model is the `Lot`
(purchaseDate, units, buyPrice). Exit load and gains are decided **per lot**, so
the engine flattens all lots in a flagged class into a single ranked pool, each
tagged with its parent instrument, holding period, classification and load flag.

**3. STCG / LTCG classification.** For equities and equity mutual funds, a lot
held **> 365 days** as of the valuation date is **LTCG**; **≤ 365 days** is
**STCG**. Debt, Gold, Real Estate and Alternatives are out of scope and labelled
`N/A`. Each sell shows the label per lot.

**4. Exit load.** Only **equity-MF** units held **< 365 days** incur the 1% load,
charged on that lot's redemption value. A direct equity held < 365 days is STCG
but bears **no** load. Because both windows share the 365-day line, a
load-bearing lot is always an STCG lot — there's a test asserting exactly that.

**5. Holdings cap.** The engine can never sell more units than a lot contains
(it only ever draws from real lots), so the cap is respected by construction.
Every sell surfaces `maxSellableUnits`, and when a recommendation liquidates an
entire position it is tagged **"Holdings cap: sells the entire position"**.

**6. The ordering decision — the one that's easy to get subtly wrong.** Two
preferences are stated: *sell load-free units first* and *realise LTCG first,
where the target can still be met*. Both point to the **same** lots — the oldest
ones — because the 365-day line is shared. So the engine uses a single ordering:
**oldest lot first** (load-free before load-bearing, LTCG before STCG, longer
holding period first, then lot id for determinism). The consequence is that a
young STCG / load-bearing lot is touched **only** when the older lots cannot
cover the required redemption — i.e. only when the target genuinely can't be met
any other way. That is precisely the "where the target can still be met"
qualifier, implemented rather than hand-waved.

**7. Independent buys and sells.** Per the brief, we don't model a cash account
and sells don't fund buys. A real and correct consequence surfaced in testing:
because sizing is done against the *current* total, and applying both a sell and
a buy changes that total, the portfolio converges to **within tolerance** rather
than exactly onto the target percentages. Client c1's equities go 75% → 59.1%
(target 55%, now within 5pp) after one apply; every class ends within tolerance,
so the badge clears. A second pass would tighten it further. This is called out
in a store test so it's a documented decision, not an accident.


## Testing & how I made sure it's correct

The engine is pure, so it's tested directly (`npm run test`, 24 tests):

- the 365-day boundary for both classification and exit load, and that a
  load-bearing lot is always STCG;
- drift threshold behaviour including the exact-5pp boundary;
- end-to-end on c1: sells equal the excess, LTCG/load-free lots are exhausted
  before the STCG lot, exit load is 1% of the STCG redemption, the cap binds on
  fully-liquidated positions, and no sell exceeds units held;
- the non-equity path on c3 (gold sell carries no tax/load labels);
- the five balanced clients produce zero actions and allocations sum to 100%;
- the store: apply brings classes within tolerance, never drives a lot negative,
  and reset restores the authored state.

`scripts/verify.ts` prints every client's drift and full plan for eyeballing.

---

## Stretch goals included

- **Unit tests for the rebalancing engine** (the most-valued one) — see above.
- **Dark mode** with a persisted toggle (localStorage, no flash on load).
- **Responsive layout** — the app is usable from tablet (768px) up; tables scroll
  horizontally below that and the KPI/allocation/chart grids collapse to one
  column.


---

## Trade-offs and what I'd do next

**Where I chose simplicity:** no cash-account modelling (per the brief); buys top
up the largest existing instrument in an underweight class rather than solving an
optimal set of purchases; the mock "server state" is an in-process module, which
is perfect for a single-process dev server and wrong for anything multi-instance.
The donut shows current allocation with target in the adjacent table rather than
a nested concentric ring — clearer for an RM scanning quickly.

**With more time:** (1) an *iterative* rebalance that re-runs after apply to drive
exactly onto target, with the convergence made explicit in the UI; (2) tax-aware
sizing that reports estimated STCG/LTCG amounts (the classification is already
there — only the tax rates are out of scope); (3) a "what-if" slider on the
365-day line so an RM can see which lots are about to cross into LTCG; (4)
persistence behind a real datastore; (5) a diff view on apply (before → after
allocation) instead of an in-place re-render.
