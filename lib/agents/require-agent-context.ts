import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export type AgentContext = {
  userId: string
  sourcingAgentId: string
  displayName: string
  status: "ACTIVE" | "PAUSED" | "PENDING" | "REJECTED"
  country: string
  city: string
}

export type AgentGuardResult =
  | { ok: true; ctx: AgentContext }
  | { ok: false; status: number; error: string }

/** Session AGENT + profil SourcingAgent lié (API routes). */
export async function requireAgentContext(): Promise<AgentGuardResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "Not authenticated" }
  }
  if (session.user.role !== "AGENT") {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const profile = await prisma.sourcingAgent.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      status: true,
      country: true,
      city: true,
    },
  })
  if (!profile) {
    return { ok: false, status: 404, error: "agent_profile_not_found" }
  }

  return {
    ok: true,
    ctx: {
      userId: session.user.id,
      sourcingAgentId: profile.id,
      displayName: profile.displayName,
      status: profile.status,
      country: profile.country,
      city: profile.city,
    },
  }
}
