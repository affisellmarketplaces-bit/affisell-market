import { IntegrationProvider, Prisma, SyncStatus } from "@prisma/client"

import { productDecoupleFieldsLive } from "@/lib/integrations/schema-capabilities"
import { prisma } from "@/lib/prisma"
import type { MappedAffisellProduct, SyncProductResult } from "@/lib/supplier-sync/types"

const DEFAULT_COMMISSION = 15

function decoupleProductFields(integrationId?: string, mapped?: MappedAffisellProduct) {
  if (!productDecoupleFieldsLive()) return {}
  return {
    sourceProductId: mapped?.externalId,
    sourceIntegrationId: integrationId ?? undefined,
    isDecoupled: false as const,
    imageSource: mapped && mapped.images.length > 0 ? "cloned" : undefined,
  }
}

/** Upsert one externally synced product — differential hash + OOS unpublish. */
export async function upsertSyncedProduct(args: {
  supplierId: string
  provider: IntegrationProvider
  mapped: MappedAffisellProduct
  integrationId?: string
  publishLive?: boolean
}): Promise<SyncProductResult> {
  const { supplierId, provider, mapped, integrationId, publishLive = false } = args
  const externalId = mapped.externalId

  const existingSelect = {
    id: true,
    externalContentHash: true,
    active: true,
    isDraft: true,
    ...(productDecoupleFieldsLive() ? { isDecoupled: true as const } : {}),
  }

  const existing = await prisma.product.findFirst({
    where: { supplierId, externalProvider: provider, externalId },
    select: existingSelect,
  })

  if (productDecoupleFieldsLive() && existing && "isDecoupled" in existing && existing.isDecoupled) {
    await prisma.product.update({
      where: { id: existing.id },
      data: { lastExternalSyncAt: new Date() },
    })
    return { externalId, action: "skipped" }
  }

  const outOfStock = mapped.stock <= 0
  const syncStatus: SyncStatus = outOfStock ? SyncStatus.UNPUBLISHED_OOS : SyncStatus.SYNCED
  const active = outOfStock ? false : publishLive
  const isDraft = outOfStock ? true : !publishLive

  if (existing?.externalContentHash === mapped.contentHash) {
    if (outOfStock && existing.active) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          active: false,
          isDraft: true,
          stock: 0,
          syncStatus,
          lastExternalSyncAt: new Date(),
        },
      })
      return { externalId, action: "unpublished" }
    }
    await prisma.product.update({
      where: { id: existing.id },
      data: { lastExternalSyncAt: new Date(), syncStatus },
    })
    return { externalId, action: "skipped" }
  }

  const productData = {
    name: mapped.name,
    description: mapped.description,
    images: mapped.images,
    basePriceCents: mapped.basePriceCents,
    stock: mapped.stock,
    supplierSku: mapped.supplierSku,
    sourceUrl: mapped.sourceUrl || undefined,
    importSource: "shopify-sync",
    externalId,
    externalProvider: provider,
    externalRaw: mapped.raw as unknown as Prisma.InputJsonValue,
    externalContentHash: mapped.contentHash,
    lastExternalSyncAt: new Date(),
    syncStatus,
    ...decoupleProductFields(integrationId, mapped),
    active,
    isDraft,
    commissionRate: DEFAULT_COMMISSION,
    categories: mapped.categoryLabel ? [mapped.categoryLabel.slice(0, 120)] : [],
    tags: ["shopify-sync", "live-sync"],
  }

  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: productData,
    })
    return { externalId, action: outOfStock ? "unpublished" : "updated" }
  }

  await prisma.product.create({
    data: {
      supplierId,
      ...productData,
      supplierTag: "shopify-sync",
    },
  })
  return { externalId, action: "created" }
}

export async function setSupplierLiveSyncFlag(userId: string, enabled: boolean): Promise<void> {
  await prisma.supplierProfile.upsert({
    where: { userId },
    create: { userId, hasLiveSync: enabled },
    update: { hasLiveSync: enabled },
  })
}

export async function markIntegrationSyncResult(args: {
  integrationId: string
  userId: string
  summary: Record<string, unknown>
  error?: string | null
}): Promise<void> {
  await prisma.supplierIntegration.update({
    where: { id: args.integrationId },
    data: {
      lastSyncAt: new Date(),
      lastSyncError: args.error ?? null,
      lastSyncSummary: args.summary as Prisma.InputJsonValue,
      errorMessage: args.error ?? null,
      status: args.error ? "ERROR" : "CONNECTED",
    },
  })
}
