import { IntegrationProvider, Prisma, SyncJobStatus } from "@prisma/client"

import { canonicalToMappedProduct } from "@/lib/integrations/map-canonical-product"
import { getIntegrationProvider } from "@/lib/integrations/registry"
import {
  isPrismaSchemaDriftError,
  productDecoupleFieldsLive,
  syncJobModelLive,
} from "@/lib/integrations/schema-capabilities"
import type { DecoupleResult, IntegrationRow, SyncRunStats } from "@/lib/integrations/types"
import { prisma } from "@/lib/prisma"
import {
  markIntegrationSyncResult,
  setSupplierLiveSyncFlag,
  upsertSyncedProduct,
} from "@/lib/supplier-sync/sync-engine"

export class SyncJobConflictError extends Error {
  readonly code = "SYNC_JOB_RUNNING" as const

  constructor(integrationId: string) {
    super(`Sync already running for integration ${integrationId}`)
    this.name = "SyncJobConflictError"
  }
}

function toIntegrationRow(row: {
  id: string
  userId: string
  provider: IntegrationProvider | null
  platform: string
  shopDomain: string | null
  accessTokenEncrypted: string | null
  refreshTokenEncrypted: string | null
  scopes: string | null
  status: IntegrationRow["status"]
  config: unknown
}): IntegrationRow {
  return row
}

function emptyStats(): SyncRunStats {
  return { imported: 0, updated: 0, skipped: 0, failed: 0, unpublished: 0, fetched: 0 }
}

async function runCatalogSync(args: {
  integration: {
    id: string
    userId: string
    provider: IntegrationProvider
    shopDomain: string | null
  }
  row: IntegrationRow
}): Promise<SyncRunStats> {
  const { integration, row } = args
  const stats = emptyStats()
  const provider = getIntegrationProvider(integration.provider)
  const shopHost = integration.shopDomain ?? ""
  const products = await provider.fetchProducts(row)
  stats.fetched = products.length

  for (const canonical of products) {
    try {
      const mapped = canonicalToMappedProduct(canonical, shopHost)
      const out = await upsertSyncedProduct({
        supplierId: integration.userId,
        provider: integration.provider,
        mapped,
        integrationId: integration.id,
        publishLive: false,
      })
      if (out.action === "created") stats.imported++
      else if (out.action === "updated") stats.updated++
      else if (out.action === "unpublished") stats.unpublished++
      else stats.skipped++
    } catch (productErr) {
      stats.failed++
      console.error("[shopify-sync]", {
        integrationId: integration.id,
        externalId: canonical.externalId,
        result: "product_upsert_failed",
        error: productErr instanceof Error ? productErr.message : String(productErr),
      })
    }
  }

  return stats
}

export class SyncOrchestrator {
  /** Idempotent catalog sync — one RUNNING job per integration when SyncJob table exists. */
  async sync(integrationId: string, supplierId: string): Promise<{ jobId: string; stats: SyncRunStats }> {
    const integration = await prisma.supplierIntegration.findFirst({
      where: { id: integrationId, userId: supplierId },
    })
    if (!integration) {
      throw new Error("Integration not found")
    }
    if (integration.status === "DISCONNECTED") {
      throw new Error("Integration is disconnected — reconnect to sync")
    }
    if (!integration.provider) {
      throw new Error("Integration provider not configured")
    }

    const row = toIntegrationRow(integration)
    let jobId = `sync-${integrationId}-${Date.now()}`

    if (syncJobModelLive()) {
      const running = await prisma.syncJob.findFirst({
        where: { integrationId, status: SyncJobStatus.RUNNING },
        select: { id: true },
      })
      if (running) {
        throw new SyncJobConflictError(integrationId)
      }

      const job = await prisma.syncJob.create({
        data: { integrationId, status: SyncJobStatus.RUNNING },
      })
      jobId = job.id

      try {
        const stats = await runCatalogSync({
          integration: {
            id: integration.id,
            userId: integration.userId,
            provider: integration.provider,
            shopDomain: integration.shopDomain,
          },
          row,
        })

        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: SyncJobStatus.COMPLETED,
            stats: stats as unknown as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        })

        await markIntegrationSyncResult({
          integrationId,
          userId: supplierId,
          summary: {
            fetched: stats.fetched,
            created: stats.imported,
            updated: stats.updated,
            skipped: stats.skipped,
            unpublished: stats.unpublished,
            failed: stats.failed,
          },
        })
        await setSupplierLiveSyncFlag(supplierId, true)

        console.log("[shopify-sync]", {
          integrationId,
          supplierId,
          jobId: job.id,
          ...stats,
          result: "completed",
        })

        return { jobId: job.id, stats }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: SyncJobStatus.FAILED,
            error: msg,
            completedAt: new Date(),
          },
        })
        await markIntegrationSyncResult({
          integrationId,
          userId: supplierId,
          summary: {},
          error: msg,
        })
        console.error("[shopify-sync]", {
          integrationId,
          supplierId,
          jobId: job.id,
          result: "failed",
          error: msg,
        })
        throw error
      }
    }

    console.warn("[shopify-sync]", {
      integrationId,
      result: "sync_without_job_table",
      hint: "npx prisma migrate deploy",
    })

    const stats = await runCatalogSync({
      integration: {
        id: integration.id,
        userId: integration.userId,
        provider: integration.provider,
        shopDomain: integration.shopDomain,
      },
      row,
    })

    await markIntegrationSyncResult({
      integrationId,
      userId: supplierId,
      summary: {
        fetched: stats.fetched,
        created: stats.imported,
        updated: stats.updated,
        skipped: stats.skipped,
        unpublished: stats.unpublished,
        failed: stats.failed,
      },
    })
    await setSupplierLiveSyncFlag(supplierId, true)

    return { jobId, stats }
  }

  /**
   * Clone & Own decouple — products stay on Affisell, tokens purged, inventory frozen.
   */
  async decouple(integrationId: string, supplierId: string): Promise<DecoupleResult> {
    const integration = await prisma.supplierIntegration.findFirst({
      where: { id: integrationId, userId: supplierId },
    })
    if (!integration) {
      throw new Error("Integration not found")
    }

    let productsDecoupled = 0

    if (productDecoupleFieldsLive()) {
      try {
        const decoupled = await prisma.product.updateMany({
          where: {
            supplierId,
            isDecoupled: false,
            OR: [
              { sourceIntegrationId: integrationId },
              {
                sourceIntegrationId: null,
                externalProvider: integration.provider ?? undefined,
                importSource: "shopify-sync",
              },
            ],
          },
          data: {
            isDecoupled: true,
            syncStatus: "MANUAL",
            sourceIntegrationId: integrationId,
          },
        })
        productsDecoupled = decoupled.count
      } catch (err) {
        if (!isPrismaSchemaDriftError(err)) throw err
        console.warn("[integration-decouple]", {
          integrationId,
          result: "product_decouple_skipped_db_drift",
          hint: "npx prisma migrate deploy",
        })
      }
    } else {
      console.warn("[integration-decouple]", {
        integrationId,
        result: "product_decouple_skipped_client",
        hint: "npx prisma generate",
      })
    }

    await prisma.supplierIntegration.update({
      where: { id: integrationId },
      data: {
        status: "DISCONNECTED",
        enabled: false,
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        errorMessage: null,
        config: {
          ...(integration.config && typeof integration.config === "object" && !Array.isArray(integration.config)
            ? (integration.config as Record<string, unknown>)
            : {}),
          oauth: false,
          decoupledAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    })

    const stillConnected = await prisma.supplierIntegration.count({
      where: {
        userId: supplierId,
        status: "CONNECTED",
        platform: integration.platform,
      },
    })
    if (stillConnected === 0) {
      await setSupplierLiveSyncFlag(supplierId, false)
    }

    console.log("[integration-decouple]", {
      integrationId,
      supplierId,
      provider: integration.provider,
      productsDecoupled,
      result: "disconnected",
    })

    return {
      integrationId,
      productsDecoupled,
      status: "DISCONNECTED",
    }
  }
}

export const syncOrchestrator = new SyncOrchestrator()

/** Fire-and-forget sync for OAuth callback — never blocks HTTP. */
export function triggerIntegrationSyncBackground(integrationId: string, supplierId: string): void {
  void syncOrchestrator.sync(integrationId, supplierId).catch((e) => {
    if (e instanceof SyncJobConflictError) return
    console.error("[shopify-sync]", {
      integrationId,
      supplierId,
      result: "background_sync_failed",
      error: e instanceof Error ? e.message : String(e),
    })
  })
}
