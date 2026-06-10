import "server-only"

import { AgentMissionAssignedEmail } from "@/emails/agent-mission-assigned"
import { AgentMissionCreditedEmail } from "@/emails/agent-mission-credited"
import { AgentMissionReportSupplierEmail } from "@/emails/agent-mission-report-supplier"
import type { AgentMissionTypeValue } from "@/lib/agents/agent-network-shared"
import { MISSION_TYPE_LABELS_FR } from "@/lib/agents/agent-mission-labels"
import { maskEmailForLog } from "@/lib/emails/mask-email"
import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import { sendResendReactEmail } from "@/lib/emails/resend-delivery"
import { prisma } from "@/lib/prisma"

const MISSION_EMAIL_SELECT = {
  id: true,
  type: true,
  status: true,
  instructions: true,
  reportSummary: true,
  photoUrls: true,
  supplierId: true,
  agent: { select: { displayName: true, contactEmail: true } },
  product: { select: { name: true } },
} as const

/** Notifie l'agent qu'une mission lui est assignée (idempotent côté Resend si rejoué). */
export async function sendAgentMissionAssignedEmail(
  missionId: string
): Promise<{ ok: boolean }> {
  const mission = await prisma.agentMission.findUnique({
    where: { id: missionId },
    select: MISSION_EMAIL_SELECT,
  })
  if (!mission?.agent?.contactEmail) {
    console.log("[agent-mission-email]", { missionId, result: "skipped_no_agent_email" })
    return { ok: false }
  }

  const sent = await sendResendReactEmail({
    context: "agent-mission-assigned",
    intendedTo: mission.agent.contactEmail,
    subject: `Mission Agent Network — ${MISSION_TYPE_LABELS_FR[mission.type as AgentMissionTypeValue] ?? mission.type}`,
    template: AgentMissionAssignedEmail,
    props: {
      agentName: mission.agent.displayName,
      missionTypeLabel:
        MISSION_TYPE_LABELS_FR[mission.type as AgentMissionTypeValue] ?? mission.type,
      productName: mission.product?.name ?? "Produit",
      instructions: mission.instructions,
      dashboardUrl: `${resolveAppUrl()}/dashboard/agent`,
    },
  })

  console.log("[agent-mission-email]", {
    missionId,
    to: maskEmailForLog(mission.agent.contactEmail),
    result: sent.ok ? "assigned_sent" : "assigned_skipped",
    error: sent.ok ? undefined : sent.error,
  })
  return { ok: sent.ok }
}

/** Notifie l'agent quand sa mission est créditée (PASSED + fee). */
export async function sendAgentMissionCreditedEmail(
  missionId: string
): Promise<{ ok: boolean }> {
  const mission = await prisma.agentMission.findUnique({
    where: { id: missionId },
    select: {
      id: true,
      type: true,
      feeCents: true,
      agent: {
        select: {
          displayName: true,
          contactEmail: true,
          balanceCents: true,
        },
      },
      product: { select: { name: true } },
    },
  })
  if (!mission?.agent?.contactEmail || mission.feeCents <= 0) {
    console.log("[agent-mission-email]", { missionId, result: "skipped_no_credit_email" })
    return { ok: false }
  }

  const amountEur = (mission.feeCents / 100).toFixed(2)
  const balanceEur = (mission.agent.balanceCents / 100).toFixed(2)
  const sent = await sendResendReactEmail({
    context: "agent-mission-credited",
    intendedTo: mission.agent.contactEmail,
    subject: `+${amountEur} € — mission validée`,
    template: AgentMissionCreditedEmail,
    props: {
      agentName: mission.agent.displayName,
      missionTypeLabel:
        MISSION_TYPE_LABELS_FR[mission.type as AgentMissionTypeValue] ?? mission.type,
      productName: mission.product?.name ?? "Produit",
      amountEur,
      balanceEur,
      dashboardUrl: `${resolveAppUrl()}/dashboard/agent`,
    },
  })

  console.log("[agent-mission-email]", {
    missionId,
    to: maskEmailForLog(mission.agent.contactEmail),
    amountCents: mission.feeCents,
    result: sent.ok ? "credited_sent" : "credited_skipped",
    error: sent.ok ? undefined : sent.error,
  })
  return { ok: sent.ok }
}

/** Fire-and-forget après crédit mission (ne bloque pas la transaction). */
export function dispatchAgentMissionCreditedEmail(missionId: string): void {
  void sendAgentMissionCreditedEmail(missionId).catch((error) => {
    console.error("[agent-mission-email]", { missionId, result: "credited_dispatch_failed", error })
  })
}

/** Notifie le fournisseur quand une mission est terminée (PASSED / FAILED). */
export async function sendSupplierMissionReportEmail(
  missionId: string
): Promise<{ ok: boolean }> {
  const mission = await prisma.agentMission.findUnique({
    where: { id: missionId },
    select: MISSION_EMAIL_SELECT,
  })
  if (!mission || (mission.status !== "PASSED" && mission.status !== "FAILED")) {
    return { ok: false }
  }
  if (!mission.reportSummary?.trim()) {
    console.log("[agent-mission-email]", { missionId, result: "skipped_no_report" })
    return { ok: false }
  }

  const supplier = await prisma.user.findUnique({
    where: { id: mission.supplierId },
    select: { email: true, role: true },
  })
  if (!supplier?.email || supplier.role !== "SUPPLIER") {
    console.log("[agent-mission-email]", { missionId, result: "skipped_no_supplier_email" })
    return { ok: false }
  }

  const passed = mission.status === "PASSED"
  const sent = await sendResendReactEmail({
    context: "agent-mission-report-supplier",
    intendedTo: supplier.email,
    subject: passed
      ? `✓ Contrôle validé — ${mission.product?.name ?? "SKU"}`
      : `✗ Contrôle échoué — ${mission.product?.name ?? "SKU"}`,
    template: AgentMissionReportSupplierEmail,
    props: {
      productName: mission.product?.name ?? "Produit",
      missionTypeLabel:
        MISSION_TYPE_LABELS_FR[mission.type as AgentMissionTypeValue] ?? mission.type,
      statusLabel: passed ? "Validée ✓" : "Échec — auto-buy coupé",
      passed,
      reportSummary: mission.reportSummary.trim(),
      photoCount: mission.photoUrls.length,
      agentName: mission.agent?.displayName ?? "Agent",
      supplyHubUrl: `${resolveAppUrl()}/dashboard/supplier/supply`,
    },
  })

  console.log("[agent-mission-email]", {
    missionId,
    supplierId: mission.supplierId,
    to: maskEmailForLog(supplier.email),
    status: mission.status,
    result: sent.ok ? "report_sent" : "report_skipped",
    error: sent.ok ? undefined : sent.error,
  })
  return { ok: sent.ok }
}

/** Fire-and-forget après transition (ne bloque pas la requête API). */
export function dispatchAgentMissionEmails(
  missionId: string,
  event: "assigned" | "completed"
): void {
  const run = async () => {
    if (event === "assigned") {
      await sendAgentMissionAssignedEmail(missionId)
      return
    }
    await sendSupplierMissionReportEmail(missionId)
  }
  void run().catch((error) => {
    console.error("[agent-mission-email]", { missionId, event, result: "dispatch_failed", error })
  })
}
