import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { resolveAdminAgentAction } from "@/lib/agents/agent-application-shared"
import { provisionAgentAccount } from "@/lib/agents/provision-agent-account"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  action: z.enum(["activate", "reject", "pause", "resume"]),
})

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdminSession()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const { action } = parsed.data

  const agent = await prisma.sourcingAgent.findUnique({
    where: { id },
    select: { id: true, status: true, contactEmail: true },
  })
  if (!agent) {
    return NextResponse.json({ error: "agent_not_found" }, { status: 404 })
  }

  const nextStatus = resolveAdminAgentAction(agent.status, action)
  if (nextStatus === null) {
    return NextResponse.json(
      { error: "invalid_transition", from: agent.status, action },
      { status: 409 }
    )
  }
  if (nextStatus === agent.status) {
    return NextResponse.json({ ok: true, id, status: agent.status, idempotent: true })
  }

  let provision: Awaited<ReturnType<typeof provisionAgentAccount>> | null = null
  if (action === "activate" && nextStatus === "ACTIVE") {
    try {
      provision = await provisionAgentAccount(id)
    } catch (error) {
      const message = error instanceof Error ? error.message : "provision_failed"
      console.error("[agent-network]", { agentId: id, result: "provision_failed", error: message })
      return NextResponse.json({ error: message }, { status: 409 })
    }
  }

  await prisma.sourcingAgent.update({
    where: { id },
    data: { status: nextStatus },
  })

  console.log("[agent-network]", {
    agentId: id,
    email: agent.contactEmail,
    from: agent.status,
    to: nextStatus,
    action,
    userId: provision?.userId ?? null,
    actorId: auth.session.user.id,
    result: "moderated",
  })

  return NextResponse.json({
    ok: true,
    id,
    status: nextStatus,
    provision: provision
      ? { userId: provision.userId, created: provision.created, loginUrl: "/login/agent" }
      : null,
  })
}
