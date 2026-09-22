import type { Product, SupplierChannelType } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { channelRequiresAuthorization, isSupplierAuthorizedForChannel } from "@/lib/supplier-auto-buy-authorization.server"

export type ResolvedChannel = {
  channel: SupplierChannelType
  providerId: string
}

/**
 * Resolve fulfillment channel + provider for a paid marketplace line. A sourcing channel
 * (real money spent on an external site) only comes back when the supplier has an active
 * `SupplierAutoBuyAuthorization` for it — otherwise this falls back to native/manual, the
 * same safe path as `autoFulfill` being off.
 */
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

  const authorize = async (candidate: ResolvedChannel): Promise<ResolvedChannel | null> => {
    if (!channelRequiresAuthorization(candidate.channel)) return candidate
    const allowed = await isSupplierAuthorizedForChannel(product.supplierId, candidate.channel)
    if (allowed) return candidate
    console.log("[resolve-fulfillment-channel]", {
      productId: product.id,
      supplierId: product.supplierId,
      channel: candidate.channel,
      result: "blocked_not_authorized",
    })
    return null
  }

  if (product.fulfillmentChannel) {
    const p = await prisma.fulfillmentProvider.findFirst({
      where: { channelType: product.fulfillmentChannel, status: "ACTIVE" },
      select: { id: true, channelType: true },
    })
    if (p) {
      const resolved = await authorize({ channel: p.channelType, providerId: p.id })
      if (resolved) return resolved
    }
  }

  const blind = await prisma.blindDropshipSupplier.findUnique({
    where: { linkedUserId: product.supplierId },
    select: { id: true, isBlindDropship: true, apiType: true },
  })
  if (blind?.isBlindDropship && blind.apiType === "rest" && product.supplierSku) {
    const provider = await ensureBlindProvider(blind.id, product.supplierId)
    return { channel: "BLIND_REST", providerId: provider.id }
  }

  const supplierLink = await prisma.supplierLink.findUnique({
    where: { productId: product.id },
    select: { isActive: true, autoBuyEnabled: true, aeProductId: true },
  })
  if (
    supplierLink?.isActive &&
    supplierLink.autoBuyEnabled &&
    supplierLink.aeProductId.trim()
  ) {
    const provider = await ensurePlatformProvider("aliexpress", "ALIEXPRESS", "AliExpress")
    const resolved = await authorize({ channel: "ALIEXPRESS", providerId: provider.id })
    if (resolved) return resolved
  }

  if (product.importSource === "aliexpress" && product.aliexpressProductId) {
    const provider = await ensurePlatformProvider("aliexpress", "ALIEXPRESS", "AliExpress")
    const resolved = await authorize({ channel: "ALIEXPRESS", providerId: provider.id })
    if (resolved) return resolved
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
