import { NextResponse } from "next/server"

import { loadAgentLedger } from "@/lib/agents/load-agent-ledger"
import { requireAgentContext } from "@/lib/agents/require-agent-context"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Ledger entries for the connected agent. */
export async function GET() {
  const guard = await requireAgentContext()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const [entries, profile] = await Promise.all([
    loadAgentLedger(guard.ctx.sourcingAgentId, 30),
    prisma.sourcingAgent.findUnique({
      where: { id: guard.ctx.sourcingAgentId },
      select: { balanceCents: true, lifetimeEarningsCents: true },
    }),
  ])

  return NextResponse.json({
    ok: true,
    balanceCents: profile?.balanceCents ?? 0,
    lifetimeEarningsCents: profile?.lifetimeEarningsCents ?? 0,
    entries,
  })
}
