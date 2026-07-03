import { NextResponse } from "next/server";
import { listPortfolios } from "@/lib/store";
import { toSummary } from "@/lib/summary";

// Reads from the in-memory store, which rebalance POSTs mutate — must stay
// dynamic or Next statically freezes this response at build time.
export const dynamic = "force-dynamic";

// GET /api/clients — client list with summary data (AUM, pre-computed returns,
// risk profile, and current-vs-target class allocation for the rebalance badge).
export function GET() {
  const clients = listPortfolios().map(toSummary);
  return NextResponse.json({ clients });
}
