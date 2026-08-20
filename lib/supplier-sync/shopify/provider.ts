import { IntegrationProvider } from "@prisma/client"

import { syncOrchestrator } from "@/lib/integrations/orchestrator"
import { prisma } from "@/lib/prisma"
import { shopifyAdminFetchJson } from "@/lib/shopify-admin-fetch"
import { DEFAULT_SHOPIFY_API_VERSION } from "@/lib/shopify-sync-map"
import { mapShopifyProductToAffisell } from "@/lib/supplier-sync/shopify/map-product"
import { resolveShopifyCredentials } from "@/lib/supplier-sync/shopify/credentials"
import { enqueueShopifyRequest } from "@/lib/supplier-sync/queue"
import {
  markIntegrationSyncResult,
  setSupplierLiveSyncFlag,
  upsertSyncedProduct,
} from "@/lib/supplier-sync/sync-engine"
import { recordSupplierWebhookEvent } from "@/lib/supplier-sync/webhook-idempotency"
import type {
  FullSyncResult,
  SupplierIntegrationRow,
  SupplierProvider,
  WebhookContext,
  WebhookHandleResult,
} from "@/lib/supplier-sync/types"

const PAGE_SIZE = 50
const MAX_PAGES = 40

export class ShopifyProvider implements SupplierProvider {
  readonly provider = IntegrationProvider.SHOPIFY

  mapProduct(raw: Record<string, unknown>, shopDomain: string) {
    return mapShopifyProductToAffisell(raw, shopDomain)
  }

  async fullSync(integration: SupplierIntegrationRow): Promise<FullSyncResult> {
    const creds = resolveShopifyCredentials(integration)
    if (!creds) {
      throw new Error("Invalid Shopify credentials")
    }

    const result: FullSyncResult = {
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      unpublished: 0,
    }

    let sinceId = 0
    for (let page = 0; page < MAX_PAGES; page++) {
      const path = `products.json?limit=${PAGE_SIZE}&since_id=${sinceId}`
      const r = await enqueueShopifyRequest(() =>
        shopifyAdminFetchJson({
          shopHost: creds.shopHost,
          accessToken: creds.accessToken,
          apiVersion: creds.apiVersion || DEFAULT_SHOPIFY_API_VERSION,
          path,
        })
      )

      if (!r.ok) {
        await markIntegrationSyncResult({
          integrationId: integration.id,
          userId: integration.userId,
          summary: result as unknown as Record<string, unknown>,
          error: r.message,
        })
        throw new Error(r.message)
      }

      const data = r.json as Record<string, unknown>
      const list = Array.isArray(data.products) ? data.products : []
      if (list.length === 0) break

      for (const item of list) {
        if (!item || typeof item !== "object" || Array.isArray(item)) continue
        const mapped = this.mapProduct(item as Record<string, unknown>, creds.shopHost)
        if (!mapped) continue
        result.fetched++
        const out = await upsertSyncedProduct({
          supplierId: integration.userId,
          provider: IntegrationProvider.SHOPIFY,
          mapped,
          publishLive: false,
        })
        if (out.action === "created") result.created++
        else if (out.action === "updated") result.updated++
        else if (out.action === "unpublished") result.unpublished++
        else result.skipped++
      }

      const last = list[list.length - 1] as Record<string, unknown>
      const lid = Number(last.id)
      sinceId = Number.isFinite(lid) ? lid : sinceId + 1
      if (list.length < PAGE_SIZE) break
    }

    await markIntegrationSyncResult({
      integrationId: integration.id,
      userId: integration.userId,
      summary: result as unknown as Record<string, unknown>,
    })
    await setSupplierLiveSyncFlag(integration.userId, true)

    console.log("[supplier-sync/shopify]", {
      integrationId: integration.id,
      supplierId: integration.userId,
      ...result,
    })

    return result
  }

  async handleWebhook(ctx: WebhookContext): Promise<WebhookHandleResult> {
    const isNew = await recordSupplierWebhookEvent({
      shopifyWebhookId: ctx.webhookId,
      topic: ctx.topic,
      shopDomain: ctx.shopDomain,
      integrationId: ctx.integration.id,
      payload: ctx.payload,
    })
    if (!isNew) {
      return { ok: true, topic: ctx.topic, action: "duplicate" }
    }

    if (ctx.topic === "app/uninstalled") {
      await syncOrchestrator.decouple(ctx.integration.id, ctx.integration.userId)
      return { ok: true, topic: ctx.topic, action: "decoupled" }
    }

    if (ctx.topic === "products/update") {
      const product = ctx.payload as Record<string, unknown>
      const mapped = this.mapProduct(product, ctx.shopDomain)
      if (!mapped) return { ok: true, topic: ctx.topic, action: "ignored" }
      const out = await upsertSyncedProduct({
        supplierId: ctx.integration.userId,
        provider: IntegrationProvider.SHOPIFY,
        mapped,
        publishLive: false,
      })
      return { ok: true, topic: ctx.topic, action: out.action }
    }

    if (ctx.topic === "inventory_levels/update") {
      const available = Number((ctx.payload as Record<string, unknown>).available)
      const inventoryItemId = String((ctx.payload as Record<string, unknown>).inventory_item_id ?? "")
      if (!inventoryItemId) return { ok: true, topic: ctx.topic, action: "ignored" }

      const candidates = await prisma.product.findMany({
        where: {
          supplierId: ctx.integration.userId,
          externalProvider: IntegrationProvider.SHOPIFY,
        },
        select: { id: true, externalId: true, externalRaw: true },
        take: 500,
        orderBy: { updatedAt: "desc" },
      })

      const match = candidates.find((p) => {
        const raw = p.externalRaw as Record<string, unknown> | null
        const variants = Array.isArray(raw?.variants) ? raw.variants : []
        return variants.some((v) => {
          if (!v || typeof v !== "object" || Array.isArray(v)) return false
          return String((v as Record<string, unknown>).inventory_item_id) === inventoryItemId
        })
      })

      if (!match?.externalId) {
        return { ok: true, topic: ctx.topic, action: "product_not_found" }
      }

      const creds = resolveShopifyCredentials(ctx.integration)
      if (!creds) return { ok: false, topic: ctx.topic, error: "missing_credentials" }

      const fetchProduct = await enqueueShopifyRequest(() =>
        shopifyAdminFetchJson({
          shopHost: creds.shopHost,
          accessToken: creds.accessToken,
          apiVersion: creds.apiVersion || DEFAULT_SHOPIFY_API_VERSION,
          path: `products/${match.externalId}.json`,
        })
      )
      if (!fetchProduct.ok) {
        return { ok: false, topic: ctx.topic, error: fetchProduct.message }
      }
      const pj = fetchProduct.json as Record<string, unknown>
      const raw = pj.product as Record<string, unknown>
      const mapped = this.mapProduct(raw, ctx.shopDomain)
      if (!mapped) return { ok: true, topic: ctx.topic, action: "ignored" }
      if (Number.isFinite(available)) mapped.stock = Math.max(0, Math.round(available))
      const out = await upsertSyncedProduct({
        supplierId: ctx.integration.userId,
        provider: IntegrationProvider.SHOPIFY,
        mapped,
        publishLive: false,
      })
      return { ok: true, topic: ctx.topic, action: out.action }
    }

    return { ok: true, topic: ctx.topic, action: "ignored" }
  }
}

/** Fire-and-forget initial sync after OAuth — never blocks HTTP response. */
export function triggerShopifyFullSyncBackground(integrationId: string): void {
  void (async () => {
    const row = await prisma.supplierIntegration.findUnique({
      where: { id: integrationId },
    })
    if (!row || row.platform !== "shopify") return
    const provider = new ShopifyProvider()
    try {
      await provider.fullSync(row)
    } catch (e) {
      console.error("[supplier-sync/shopify]", {
        integrationId,
        result: "background_sync_failed",
        error: e instanceof Error ? e.message : String(e),
      })
    }
  })()
}
