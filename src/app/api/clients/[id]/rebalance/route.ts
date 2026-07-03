import { NextResponse } from "next/server";
import { applyRebalance, getPortfolio, resetPortfolio } from "@/lib/store";
import type { RebalanceAction } from "@/lib/types";

// POST /api/clients/:id/rebalance — accepts proposed actions, applies them, and
// returns the updated portfolio so the UI can reflect the new allocation.
// Body: { actions: RebalanceAction[] }  OR  { reset: true } to restore state.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!getPortfolio(params.id)) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  let body: { actions?: RebalanceAction[]; reset?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.reset) {
    return NextResponse.json({ portfolio: resetPortfolio(params.id) });
  }

  if (!Array.isArray(body.actions)) {
    return NextResponse.json(
      { error: "Expected `actions` array or `reset: true`" },
      { status: 400 },
    );
  }

  const portfolio = applyRebalance(params.id, body.actions);
  return NextResponse.json({ portfolio });
}
