import { NextResponse } from "next/server";
import { performanceByClient } from "@/lib/data";
import { getPortfolio } from "@/lib/store";

// GET /api/clients/:id/performance — date-aligned portfolio and benchmark series.
export function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!getPortfolio(params.id)) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const performance = performanceByClient[params.id];
  return NextResponse.json({ performance });
}
