import { NextResponse } from "next/server"

import {
  normalizeAgentApplication,
  type AgentApplicationInput,
} from "@/lib/agents/agent-application-shared"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Candidature publique Agent Network.
 * Idempotent : email déjà PENDING → 200 deduped ; REJECTED → réouverture en PENDING.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const input = normalizeAgentApplication(body)
  if (!input) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const result = await submitAgentApplication(input)
  if (!result.ok) {
    const status = result.error === "already_active" ? 409 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  console.log("[agent-apply]", {
    email: input.contactEmail,
    country: input.country,
    capabilities: input.capabilities,
    deduped: result.deduped ?? false,
    reapplied: result.reapplied ?? false,
    result: "submitted",
  })

  return NextResponse.json({
    ok: true,
    deduped: result.deduped ?? false,
    reapplied: result.reapplied ?? false,
  })
}

/** Logique testable sans HTTP. */
export async function submitAgentApplication(
  input: AgentApplicationInput
): Promise<{ ok: true; deduped?: boolean; reapplied?: boolean } | { ok: false; error: string }> {
  const existing = await prisma.sourcingAgent.findUnique({
    where: { contactEmail: input.contactEmail },
    select: { id: true, status: true },
  })

  if (existing?.status === "PENDING") {
    return { ok: true, deduped: true }
  }
  if (existing?.status === "ACTIVE" || existing?.status === "PAUSED") {
    return { ok: false, error: "already_active" }
  }

  const data = {
    displayName: input.displayName,
    country: input.country,
    city: input.city,
    capabilities: input.capabilities,
    languages: input.languages,
    leadTimeHours: input.leadTimeHours,
    applicationNote: input.applicationNote ?? null,
    contactPhone: input.contactPhone ?? null,
    status: "PENDING" as const,
  }

  if (existing?.status === "REJECTED") {
    await prisma.sourcingAgent.update({ where: { id: existing.id }, data })
    return { ok: true, reapplied: true }
  }

  await prisma.sourcingAgent.create({
    data: { contactEmail: input.contactEmail, ...data },
  })
  return { ok: true }
}
