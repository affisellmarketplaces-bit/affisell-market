import { prisma } from "@/lib/prisma"

export type AgentLedgerRow = {
  id: string
  type: "CREDIT" | "DEBIT"
  amountCents: number
  balanceAfterCents: number
  note: string | null
  createdAt: string
}

export async function loadAgentLedger(agentId: string, limit = 20): Promise<AgentLedgerRow[]> {
  const rows = await prisma.agentLedgerEntry.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      amountCents: true,
      balanceAfterCents: true,
      note: true,
      createdAt: true,
    },
  })
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }))
}
