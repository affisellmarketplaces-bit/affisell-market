#!/usr/bin/env node
/**
 * Relance les suppliers sans intégration Shopify/Woo quand des FulfillmentGroups
 * sont en attente manuelle (AWAITING_SHIPMENT + supplierIntegrationId null).
 *
 * Usage:
 *   npx tsx scripts/email-manual-suppliers.ts --dry-run
 *   npx tsx scripts/email-manual-suppliers.ts --send
 */
import "dotenv/config"

import {
  FulfillmentGroupStatus,
  IntegrationProvider,
  IntegrationStatus,
  PrismaClient,
} from "@prisma/client"

import { resolveAppUrl } from "@/lib/emails/send-order-confirmation"
import {
  readResendDeliveryConfig,
  sendResendEmail,
} from "@/lib/emails/resend-delivery"
import { getPrismaDirectDatasourceUrl, getPrismaDatasourceUrl } from "@/lib/prisma-datasource-url"

type SupplierAgg = {
  supplierId: string
  email: string
  name: string
  manualGroups: number
  totalItems: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createScriptPrisma(): PrismaClient {
  const url = getPrismaDirectDatasourceUrl() ?? getPrismaDatasourceUrl()
  return new PrismaClient({ datasources: { db: { url } } })
}

function buildManualSupplierEmailHtml(args: {
  name: string
  manualGroups: number
  totalItems: number
  integrationsUrl: string
}): string {
  const { name, manualGroups, totalItems, integrationsUrl } = args
  return `
    <div style="font-family: sans-serif; max-width: 600px;">
      <h2>Bonjour ${name},</h2>
      <p>Vous avez <b>${manualGroups} commande(s) (${totalItems} article${totalItems > 1 ? "s" : ""})</b> en attente de traitement manuel sur Affisell.</p>
      <p>C'est parce que vos produits ne sont pas liés à votre boutique. Activez l'auto-expédition en 2 clics :</p>
      <p><a href="${integrationsUrl}" style="background:#111827;color:white;padding:12px 20px;text-decoration:none;border-radius:8px;display:inline-block;">Connecter Shopify / WooCommerce</a></p>
      <p>Une fois connecté, l'orchestrateur passera automatiquement en auto-buy.</p>
      <p style="color:#6b7280;font-size:12px;">Vous recevez cet email car vous avez ${manualGroups} FulfillmentGroup(s) en attente manuelle (sans intégration active).</p>
    </div>
  `.trim()
}

async function loadManualRequiredGroups(prisma: PrismaClient) {
  return prisma.fulfillmentGroup.findMany({
    where: {
      status: FulfillmentGroupStatus.AWAITING_SHIPMENT,
      supplierIntegrationId: null,
    },
    include: {
      items: { select: { id: true, orderId: true, quantity: true } },
    },
  })
}

async function buildSupplierAggregates(prisma: PrismaClient): Promise<SupplierAgg[]> {
  const groups = await loadManualRequiredGroups(prisma)
  console.log("[ing:email-campaign]", {
    result: "groups_loaded",
    manualGroups: groups.length,
  })

  if (groups.length === 0) return []

  const supplierIds = [...new Set(groups.map((g) => g.supplierId))]
  const [users, connectedIntegrations] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: supplierIds }, role: "SUPPLIER" },
      select: { id: true, email: true, name: true },
    }),
    prisma.supplierIntegration.findMany({
      where: {
        userId: { in: supplierIds },
        status: IntegrationStatus.CONNECTED,
        enabled: true,
        provider: { in: [IntegrationProvider.SHOPIFY, IntegrationProvider.WOOCOMMERCE] },
      },
      select: { userId: true, provider: true },
    }),
  ])

  const userById = new Map(users.map((u) => [u.id, u]))
  const connectedByUserId = new Map<string, IntegrationProvider>()
  for (const row of connectedIntegrations) {
    if (row.provider && !connectedByUserId.has(row.userId)) {
      connectedByUserId.set(row.userId, row.provider)
    }
  }

  const map = new Map<string, SupplierAgg>()

  for (const group of groups) {
    const supplierId = group.supplierId
    const connectedProvider = connectedByUserId.get(supplierId)
    if (connectedProvider) {
      console.log("[ing:email-campaign]", {
        result: "skip_connected",
        supplierId,
        provider: connectedProvider,
      })
      continue
    }

    const user = userById.get(supplierId)
    if (!user?.email?.trim()) {
      console.log("[ing:email-campaign]", { result: "skip_no_email", supplierId })
      continue
    }

    if (!map.has(supplierId)) {
      map.set(supplierId, {
        supplierId,
        email: user.email.trim(),
        name: user.name?.trim() || "Supplier",
        manualGroups: 0,
        totalItems: 0,
      })
    }

    const agg = map.get(supplierId)!
    agg.manualGroups += 1
    agg.totalItems += group.items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0)
  }

  return Array.from(map.values()).sort((a, b) => b.manualGroups - a.manualGroups)
}

async function sendCampaignEmails(suppliers: SupplierAgg[]): Promise<void> {
  const config = readResendDeliveryConfig()
  if (!config) {
    console.warn("[ing:email-campaign]", {
      result: "mock_send_only",
      reason: "RESEND_API_KEY missing",
      count: suppliers.length,
    })
  }

  const integrationsUrl = `${resolveAppUrl()}/dashboard/supplier/integrations`

  for (const supplier of suppliers) {
    const subject = `Action requise: ${supplier.manualGroups} commande(s) en attente — Activez l'auto-buy`
    const html = buildManualSupplierEmailHtml({
      name: supplier.name,
      manualGroups: supplier.manualGroups,
      totalItems: supplier.totalItems,
      integrationsUrl,
    })

    try {
      if (!config) {
        console.log("[ing:email-campaign]", {
          result: "mock_sent",
          email: supplier.email,
          manualGroups: supplier.manualGroups,
        })
        continue
      }

      const sendResult = await sendResendEmail({
        context: "ing:email-campaign",
        config,
        intendedTo: supplier.email,
        subject,
        html,
      })

      if (!sendResult.ok) {
        console.error("[ing:email-campaign]", {
          result: "send_failed",
          email: supplier.email,
          error: sendResult.error,
        })
        continue
      }

      console.log("[ing:email-campaign]", {
        result: "sent",
        email: supplier.email,
        manualGroups: supplier.manualGroups,
        resendId: sendResult.resendId,
      })

      await sleep(150)
    } catch (error) {
      console.error("[ing:email-campaign]", {
        result: "send_exception",
        email: supplier.email,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--send")
  console.log("[ing:email-campaign]", { mode: dryRun ? "DRY-RUN" : "SEND" })

  const prisma = createScriptPrisma()
  try {
    const suppliers = await buildSupplierAggregates(prisma)
    console.log("[ing:email-campaign]", {
      result: "suppliers_ready",
      count: suppliers.length,
    })
    console.table(
      suppliers.map((s) => ({
        email: s.email,
        groups: s.manualGroups,
        items: s.totalItems,
      }))
    )

    if (suppliers.length === 0) {
      console.log("[ing:email-campaign]", { result: "nothing_to_send" })
      return
    }

    if (dryRun) {
      const sample = suppliers[0]!
      console.log("\n[DRY-RUN] Aucun email envoyé. Relance avec --send pour envoyer.")
      console.log("[ing:email-campaign]", {
        result: "sample_subject",
        subject: `Action requise: ${sample.manualGroups} commande(s) en attente — Activez l'auto-buy`,
        email: sample.email,
      })
      return
    }

    await sendCampaignEmails(suppliers)
    console.log("[ing:email-campaign]", { result: "campaign_complete", sent: suppliers.length })
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error("[ing:email-campaign]", {
    result: "fatal",
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
