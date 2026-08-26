import {
  FulfillmentGroupStatus,
  IntegrationProvider,
  IntegrationStatus,
  type PrismaClient,
} from "@prisma/client"

export const MANUAL_NUDGE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000
export const MANUAL_NUDGE_COOLDOWN_MS = 48 * 60 * 60 * 1000
export const MANUAL_NUDGE_SEND_DELAY_MS = 150

export type ManualSupplierNudgeCandidate = {
  supplierId: string
  email: string
  name: string
  manualGroups: number
  totalItems: number
}

export function buildManualSupplierNudgeEmailHtml(args: {
  name: string
  manualGroups: number
  totalItems: number
  integrationsUrl: string
  isCron?: boolean
}): string {
  const { name, manualGroups, totalItems, integrationsUrl, isCron = false } = args
  const footer = isCron
    ? `<p style="color:#6b7280;font-size:12px;">Relance automatique quotidienne — max 1 tous les 48h.</p>`
    : `<p style="color:#6b7280;font-size:12px;">Vous recevez cet email car vous avez ${manualGroups} FulfillmentGroup(s) en attente manuelle (sans intégration active).</p>`

  return `
    <div style="font-family: sans-serif; max-width: 600px;">
      <h2>Bonjour ${name},</h2>
      <p>Vous avez <b>${manualGroups} commande(s) (${totalItems} article${totalItems > 1 ? "s" : ""})</b> en attente de traitement manuel sur Affisell (7 derniers jours).</p>
      <p>C'est parce que vos produits ne sont pas liés à votre boutique. Activez l'auto-expédition :</p>
      <p><a href="${integrationsUrl}" style="background:#111827;color:white;padding:12px 20px;text-decoration:none;border-radius:8px;display:inline-block;">Connecter ma boutique</a></p>
      <p>Une fois connecté, l'orchestrateur passera automatiquement en auto-buy.</p>
      ${footer}
    </div>
  `.trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** manual_required in logs = AWAITING_SHIPMENT + no supplierIntegrationId (orchestrator). */
export const MANUAL_REQUIRED_GROUP_WHERE = {
  status: FulfillmentGroupStatus.AWAITING_SHIPMENT,
  supplierIntegrationId: null,
} as const

async function findRecentIngNudgeLogs(
  prisma: PrismaClient,
  supplierIds: string[],
  cooldownMs: number
): Promise<Array<{ supplierId: string }>> {
  if (supplierIds.length === 0) return []
  try {
    return await prisma.ingNudgeLog.findMany({
      where: {
        supplierId: { in: supplierIds },
        createdAt: { gte: new Date(Date.now() - cooldownMs) },
      },
      select: { supplierId: true },
    })
  } catch (error) {
    console.warn("[cron:ing-manual-nudge]", {
      result: "nudge_log_unavailable",
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

export async function loadManualSupplierNudgeCandidates(
  prisma: PrismaClient,
  options?: {
    lookbackMs?: number
    cooldownMs?: number
    enforceCooldown?: boolean
  }
): Promise<{ groupsCount: number; candidates: ManualSupplierNudgeCandidate[] }> {
  const lookbackMs = options?.lookbackMs ?? MANUAL_NUDGE_LOOKBACK_MS
  const cooldownMs = options?.cooldownMs ?? MANUAL_NUDGE_COOLDOWN_MS
  const enforceCooldown = options?.enforceCooldown ?? true
  const lookbackCutoff = new Date(Date.now() - lookbackMs)

  const groups = await prisma.fulfillmentGroup.findMany({
    where: {
      ...MANUAL_REQUIRED_GROUP_WHERE,
      createdAt: { gte: lookbackCutoff },
    },
    include: {
      items: { select: { id: true, quantity: true } },
    },
  })

  if (groups.length === 0) {
    return { groupsCount: 0, candidates: [] }
  }

  const supplierIds = [...new Set(groups.map((g) => g.supplierId))]
  const [users, connectedIntegrations, recentNudges] = await Promise.all([
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
    enforceCooldown
      ? findRecentIngNudgeLogs(prisma, supplierIds, cooldownMs)
      : Promise.resolve([]),
  ])

  const userById = new Map(users.map((u) => [u.id, u]))
  const connectedByUserId = new Set(connectedIntegrations.map((row) => row.userId))
  const recentlyNudged = new Set(recentNudges.map((row) => row.supplierId))
  const map = new Map<string, ManualSupplierNudgeCandidate>()

  for (const group of groups) {
    const supplierId = group.supplierId
    if (connectedByUserId.has(supplierId)) continue

    if (enforceCooldown && recentlyNudged.has(supplierId)) {
      console.log("[ing:manual-nudge]", {
        result: "skip_recent_nudge",
        supplierId,
      })
      continue
    }

    const user = userById.get(supplierId)
    if (!user?.email?.trim()) continue

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

  return {
    groupsCount: groups.length,
    candidates: Array.from(map.values()).sort((a, b) => b.manualGroups - a.manualGroups),
  }
}

export async function recordIngNudgeLog(
  prisma: PrismaClient,
  args: { supplierId: string; groupsCount: number; resendId?: string | null }
): Promise<void> {
  try {
    await prisma.ingNudgeLog.create({
      data: {
        supplierId: args.supplierId,
        groupsCount: args.groupsCount,
        resendId: args.resendId?.trim() || null,
      },
    })
  } catch (error) {
    console.warn("[cron:ing-manual-nudge]", {
      result: "nudge_log_write_skipped",
      supplierId: args.supplierId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/** @deprecated use recordIngNudgeLog */
export const recordManualSupplierNudgeLog = recordIngNudgeLog

export { sleep as manualNudgeSendDelay }
