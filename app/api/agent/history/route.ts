import { auth } from "@/auth"
import { buildAgentHistoryResponse } from "@/lib/agent-history"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Guest session id must match `localStorage` value sent from the agent page. */
export async function GET(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null
  const { searchParams } = new URL(req.url)
  const sessionId = userId ? null : (searchParams.get("sessionId")?.trim() || null)

  const data = await buildAgentHistoryResponse(prisma, { userId, sessionId })
  return Response.json(data)
}
