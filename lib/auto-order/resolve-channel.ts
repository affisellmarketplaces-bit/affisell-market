import type { Product, SupplierChannelType } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  channelRequiresAuthorization,
  isSupplierAuthorizedForChannel,
} from "@/lib/supplier-auto-buy-authorization.server"

export type ResolvedChannel = {
  channel: SupplierChannelType
  providerId: string
}

/** What the engine WOULD use for a product, computed without writing anything (checkout deliverability). */
export type FulfillmentDependency = {
  channel: SupplierChannelType
  /** The payment method of the provider the engine would use (a platform / blind provider not created yet gets the
   * method it would be created with). */
  paymentMethod: string
}

type ProviderStrategy = {
  native(supplierUserId: string): Promise<{ id: string; paymentMethod: string }>
  blind(blindId: string, supplierUserId: string): Promise<{ id: string; paymentMethod: string }>
  platform(slug: string, channel: SupplierChannelType, name: string): Promise<{ id: string; paymentMethod: string }>
}

const WRITE_STRATEGY: ProviderStrategy = {
  native: async (s) => ({ ...(await ensureNativeProvider(s)), paymentMethod: "NONE" }),
  blind: async (b, s) => ({ ...(await ensureBlindProvider(b, s)), paymentMethod: "STRIPE_CONNECT" }),
  platform: async (slug, c, n) => ({ ...(await ensurePlatformProvider(slug, c, n)), paymentMethod: "INVOICE_NET30" }),
}

/** Reads the provider rows the WRITE strategy would upsert; a missing row answers with its creation defaults. */
const READ_STRATEGY: ProviderStrategy = {
  async native(supplierUserId) {
    const row = await prisma.fulfillmentProvider.findUnique({
      where: { slug: `native-${supplierUserId}` },
      select: { id: true, paymentMethod: true },
    })
    return row ?? { id: "", paymentMethod: "NONE" }
  },
  async blind(blindId) {
    const row = await prisma.fulfillmentProvider.findUnique({
      where: { slug: `blind-${blindId}` },
      select: { id: true, paymentMethod: true },
    })
    return row ?? { id: "", paymentMethod: "STRIPE_CONNECT" }
  },
  async platform(slug) {
    const row = await prisma.fulfillmentProvider.findUnique({
      where: { slug },
      select: { id: true, paymentMethod: true },
    })
    return row ?? { id: "", paymentMethod: "INVOICE_NET30" }
  },
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
  >,
): Promise<ResolvedChannel | null> {
  const r = await resolveCore(product, WRITE_STRATEGY)
  return r ? { channel: r.channel, providerId: r.providerId } : null
}

/**
 * The SAME decision as resolveFulfillmentChannel (same order, same authorisation checks), but READ-ONLY: used before
 * payment to know whether a product will need an automatic supplier purchase. null = the engine does not handle it.
 */
export async function resolveFulfillmentDependency(
  product: Parameters<typeof resolveFulfillmentChannel>[0],
): Promise<FulfillmentDependency | null> {
  const r = await resolveCore(product, READ_STRATEGY)
  return r ? { channel: r.channel, paymentMethod: r.paymentMethod } : null
}

async function resolveCore(
  product: Parameters<typeof resolveFulfillmentChannel>[0],
  providers: ProviderStrategy,
): Promise<(ResolvedChannel & { paymentMethod: string }) | null> {
  if (!product.autoFulfill) return null

  type Candidate = ResolvedChannel & { paymentMethod: string }
  const authorize = async (candidate: Candidate): Promise<Candidate | null> => {
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
      select: { id: true, channelType: true, paymentMethod: true },
    })
    if (p) {
      const resolved = await authorize({ channel: p.channelType, providerId: p.id, paymentMethod: p.paymentMethod })
      if (resolved) return resolved
    }
  }

  const blind = await prisma.blindDropshipSupplier.findUnique({
    where: { linkedUserId: product.supplierId },
    select: { id: true, isBlindDropship: true, apiType: true },
  })
  if (blind?.isBlindDropship && blind.apiType === "rest" && product.supplierSku) {
    const provider = await providers.blind(blind.id, product.supplierId)
    return { channel: "BLIND_REST", providerId: provider.id, paymentMethod: provider.paymentMethod }
  }

  const supplierLink = await prisma.supplierLink.findUnique({
    where: { productId: product.id },
    select: { isActive: true, autoBuyEnabled: true, aeProductId: true },
  })
  if (supplierLink?.isActive && supplierLink.autoBuyEnabled && supplierLink.aeProductId.trim()) {
    const provider = await providers.platform("aliexpress", "ALIEXPRESS", "AliExpress")
    const resolved = await authorize({
      channel: "ALIEXPRESS",
      providerId: provider.id,
      paymentMethod: provider.paymentMethod,
    })
    if (resolved) return resolved
  }

  if (product.importSource === "aliexpress" && product.aliexpressProductId) {
    const provider = await providers.platform("aliexpress", "ALIEXPRESS", "AliExpress")
    const resolved = await authorize({
      channel: "ALIEXPRESS",
      providerId: provider.id,
      paymentMethod: provider.paymentMethod,
    })
    if (resolved) return resolved
  }

  const native = await providers.native(product.supplierId)
  return { channel: "AFFISELL_NATIVE", providerId: native.id, paymentMethod: native.paymentMethod }
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
