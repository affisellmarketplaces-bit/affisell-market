/**
 * Lie les agents ACTIVE sans userId à un compte User (role AGENT).
 * Usage : npm run agents:provision-users
 */
import { provisionAgentAccount } from "@/lib/agents/provision-agent-account"
import { prisma } from "@/lib/prisma"

async function main() {
  const agents = await prisma.sourcingAgent.findMany({
    where: { status: "ACTIVE", userId: null },
    select: { id: true, displayName: true, contactEmail: true },
  })
  let linked = 0
  for (const agent of agents) {
    const result = await provisionAgentAccount(agent.id)
    linked += 1
    console.log("[agents-provision-users]", {
      agentId: agent.id,
      email: agent.contactEmail,
      userId: result.userId,
      created: result.created,
    })
  }
  console.log("[agents-provision-users]", { total: agents.length, linked, result: "ok" })
}

main()
  .catch((error) => {
    console.error("[agents-provision-users]", { result: "fatal", error })
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
