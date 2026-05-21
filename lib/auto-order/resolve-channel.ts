import type { Product, SupplierChannelType } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export type ResolvedChannel = {
  channel: SupplierChannelType
  providerId: string
}

/** Resolve fulfillment channel + provider for a paid marketplace line. */
export async function resolveFulfillmentChannel(
  product: Pick<
    Product,
    | "id"
    | "supplierId"
    | "autoFulfill"
    | "fulfillmentChannel"
    | "importSource"
    | "aliexpressProductId"
    | "supplierSku"
    | "supplierWholesaleCents"
  >
): Promise<ResolvedChannel | null> {
  if (!product.autoFulfill) return null

  if (product.fulfillmentChannel) {
    const p = await prisma.fulfillmentProvider.findFirst({
      where: { channelType: product.fulfillmentChannel, status: "ACTIVE" },
      select: { id: true, channelType: true },
    })
    if (p) return { channel: p.channelType, providerId: p.id }
  }

  const blind = await prisma.blindDropshipSupplier.findUnique({
    where: { linkedUserId: product.supplierId },
    select: { id: true, isBlindDropship: true, apiType: true },
  })
  if (blind?.isBlindDropship && blind.apiType === "rest" && product.supplierSku) {
    const provider = await ensureBlindProvider(blind.id, product.supplierId)
    return { channel: "BLIND_REST", providerId: provider.id }
  }

  if (product.importSource === "aliexpress" && product.aliexpressProductId) {
    const provider = await ensurePlatformProvider("aliexpress", "ALIEXPRESS", "AliExpress")
    return { channel: "ALIEXPRESS", providerId: provider.id }
  }

  const native = await ensureNativeProvider(product.supplierId)
  return { channel: "AFFISELL_NATIVE", providerId: native.id }
}

async function ensureNativeProvider(supplierUserId: string) {
  const slug = `native-${supplierUserId}`
  return prisma.fulfillmentProvider.upsert({
    where: { slug },
    create: {
      slug,
      name: "Affisell native supplier",
      channelType: "AFFISELL_NATIVE",
      paymentMethod: "NONE",
      supplierUserId,
    },
    update: {},
    select: { id: true },
  })
}

async function ensureBlindProvider(blindId: string, supplierUserId: string) {
  const slug = `blind-${blindId}`
  return prisma.fulfillmentProvider.upsert({
    where: { slug },
    create: {
      slug,
      name: "Blind REST partner",
      channelType: "BLIND_REST",
      paymentMethod: "STRIPE_CONNECT",
      blindDropshipSupplierId: blindId,
      supplierUserId,
    },
    update: {},
    select: { id: true },
  })
}

async function ensurePlatformProvider(slug: string, channel: SupplierChannelType, name: string) {
  return prisma.fulfillmentProvider.upsert({
    where: { slug },
    create: {
      slug,
      name,
      channelType: channel,
      paymentMethod: "INVOICE_NET30",
    },
    update: {},
    select: { id: true },
  })
}
