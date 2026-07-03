import { NextResponse } from "next/server";
import { getPortfolio } from "@/lib/store";

// GET /api/clients/:id/portfolio — full portfolio: holdings, purchase lots, and
// target allocation. Current allocation and weights are derived on the client.
export function GET(_req: Request, { params }: { params: { id: string } }) {
  const portfolio = getPortfolio(params.id);
  if (!portfolio) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  return NextResponse.json({ portfolio });
}
