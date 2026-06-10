import { prisma } from "@/lib/prisma"

export type ProvisionAgentResult = {
  userId: string
  created: boolean
  linked: boolean
}

/**
 * Crée ou lie un compte User (role AGENT) à l'activation d'une candidature.
 * Idempotent : rejouer sur un agent déjà lié renvoie le même userId.
 * L'agent définit son mot de passe via « Mot de passe oublié » sur /login/agent.
 */
export async function provisionAgentAccount(agentId: string): Promise<ProvisionAgentResult> {
  const agent = await prisma.sourcingAgent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      displayName: true,
      contactEmail: true,
      userId: true,
    },
  })
  if (!agent) {
    throw new Error("agent_not_found")
  }
  if (agent.userId) {
    return { userId: agent.userId, created: false, linked: true }
  }

  const email = agent.contactEmail.trim().toLowerCase()
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  })

  if (existing) {
    if (existing.role === "ADMIN") {
      throw new Error("email_is_admin")
    }
    const taken = await prisma.sourcingAgent.findFirst({
      where: { userId: existing.id, id: { not: agentId } },
      select: { id: true },
    })
    if (taken) {
      throw new Error("user_already_linked")
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.id },
        data: { role: "AGENT", name: agent.displayName },
      }),
      prisma.sourcingAgent.update({
        where: { id: agentId },
        data: { userId: existing.id },
      }),
    ])
    console.log("[agent-provision]", {
      agentId,
      userId: existing.id,
      email,
      created: false,
      result: "linked_existing_user",
    })
    return { userId: existing.id, created: false, linked: true }
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: agent.displayName,
      role: "AGENT",
    },
    select: { id: true },
  })
  await prisma.sourcingAgent.update({
    where: { id: agentId },
    data: { userId: user.id },
  })

  console.log("[agent-provision]", {
    agentId,
    userId: user.id,
    email,
    created: true,
    result: "user_created",
  })
  return { userId: user.id, created: true, linked: true }
}
