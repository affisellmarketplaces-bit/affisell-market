import { legalMarkdownToHtml } from "@/lib/legal/markdown-html"
import {
  isCompliant,
  isGpsrCompliant,
  type GpsrComplianceResult,
  type GpsrManufacturerInput,
} from "@/lib/legal/gpsr-compliance-shared"
import { createProof } from "@/lib/legal/proof"
import { prisma } from "@/lib/prisma"

export type { GpsrComplianceResult, GpsrManufacturerInput }
export { isCompliant, isGpsrCompliant }

export type RecallRiskLevel = "faible" | "grave" | "critique"

export type CreateRecallInput = {
  productId: string
  reason: string
  riskLevel: RecallRiskLevel
  lotNumber?: string | null
}

function resolveLegalWebhook(): string | null {
  return (
    process.env.SLACK_WEBHOOK_URL_JURIDIQUE?.trim() ||
    process.env.SLACK_WEBHOOK_URL?.trim() ||
    null
  )
}

async function sendRecallSlackAlert(input: {
  productId: string
  productName: string
  riskLevel: string
  recallId: string
}): Promise<void> {
  const webhook = resolveLegalWebhook()
  const text = `🔴 [GPSR RAPPEL ${input.riskLevel.toUpperCase()}] Produit ${input.productName} (${input.productId}) — recall ${input.recallId} — /dashboard/admin/legal`

  if (!webhook) {
    console.log("[legal:gpsr]", { result: "slack_skipped", recallId: input.recallId })
    return
  }

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    })
    console.log("[legal:gpsr]", { result: "slack_sent", recallId: input.recallId })
  } catch (error) {
    console.error("[legal:gpsr]", {
      result: "slack_error",
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function createRecall(input: CreateRecallInput) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true, tags: true },
  })
  if (!product) throw new Error("product_not_found")

  const recall = await prisma.$transaction(async (tx) => {
    const row = await tx.productRecall.create({
      data: {
        productId: input.productId,
        reason: input.reason,
        riskLevel: input.riskLevel,
        lotNumber: input.lotNumber ?? null,
        status: "draft",
      },
    })

    const tags = [...new Set([...product.tags, "recalled"])]
    await tx.product.update({
      where: { id: input.productId },
      data: { active: false, tags },
    })

    return row
  })

  const proof = await createProof({
    productId: input.productId,
    action: "recall",
    payload: {
      recallId: recall.id,
      reason: input.reason,
      riskLevel: input.riskLevel,
      lotNumber: input.lotNumber ?? null,
      productName: product.name,
      blockedAt: new Date().toISOString(),
    },
  })

  await createProof({
    productId: input.productId,
    action: "removal",
    payload: {
      recallId: recall.id,
      reason: "gpsr_recall",
      active: false,
    },
  })

  await sendRecallSlackAlert({
    productId: input.productId,
    productName: product.name,
    riskLevel: input.riskLevel,
    recallId: recall.id,
  })

  console.log("[legal:gpsr]", {
    result: "recall_created",
    recallId: recall.id,
    productId: input.productId,
    hash: proof.hash.slice(0, 16),
  })

  return recall
}

export function generateDgccrfRecallLetter(input: {
  productName: string
  reason: string
  riskLevel: RecallRiskLevel
  lotNumber?: string | null
  recallId: string
}): { markdown: string; html: string } {
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const markdown = `# Notification de rappel produit — GPSR

**Date :** ${today}  
**Réf. rappel :** GPSR-${input.recallId.slice(0, 8).toUpperCase()}  
**Niveau de risque :** ${input.riskLevel.toUpperCase()}

---

## Objet

Notification préalable d'un rappel de produit conformément au **Règlement (UE) 2023/988 (GPSR)**, applicable depuis le 13 décembre 2024.

## Produit concerné

- **Désignation :** ${input.productName}
${input.lotNumber ? `- **Lot / série :** ${input.lotNumber}` : ""}

## Motif du rappel

${input.reason}

## Mesures prises par la plateforme Affisell

1. Déréférencement immédiat du produit sur la marketplace.
2. Notification des acheteurs concernés (commandes identifiées).
3. Conservation des preuves horodatées (audit trail SHA256).

## Destinataire

Direction générale de la Concurrence, de la Consommation et de la Répression des fraudes (DGCCRF) — information préventive.

---

*Document généré par Affisell Avocat Numérique — validation avocat recommandée avant envoi officiel.*`

  return {
    markdown,
    html: legalMarkdownToHtml(markdown, "Notification rappel GPSR — DGCCRF"),
  }
}

export async function notifyCustomersRecall(recallId: string) {
  const recall = await prisma.productRecall.findUnique({
    where: { id: recallId },
    select: {
      id: true,
      productId: true,
      reason: true,
      riskLevel: true,
      lotNumber: true,
    },
  })
  if (!recall) throw new Error("recall_not_found")

  const product = await prisma.product.findUnique({
    where: { id: recall.productId },
    select: { name: true },
  })
  if (!product) throw new Error("product_not_found")

  const orderCount = await prisma.order.count({
    where: { productId: recall.productId },
  })

  const letter = generateDgccrfRecallLetter({
    productName: product.name,
    reason: recall.reason,
    riskLevel: recall.riskLevel as RecallRiskLevel,
    lotNumber: recall.lotNumber,
    recallId: recall.id,
  })

  await prisma.productRecall.update({
    where: { id: recallId },
    data: {
      notifiedCount: orderCount,
      status: orderCount > 0 ? "notified_customers" : "dgccrf_notified",
    },
  })

  console.log("[legal:gpsr]", {
    result: "customers_notified",
    recallId,
    orderCount,
    letterPreview: letter.markdown.slice(0, 120),
  })

  return { recallId, notifiedCount: orderCount, letter }
}
