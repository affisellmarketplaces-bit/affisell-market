import type { FulfillmentProvider, SupplierChannelType } from "@prisma/client"

import { AliExpressSupplierAdapter } from "@/lib/suppliers/adapters/aliexpress.adapter"
import { BlindRestSupplierAdapter } from "@/lib/suppliers/adapters/blind-rest.adapter"
import { ManualSupplierAdapter } from "@/lib/suppliers/adapters/manual.adapter"
import { NativeSupplierAdapter } from "@/lib/suppliers/adapters/native.adapter"
import { StubChannelSupplierAdapter } from "@/lib/suppliers/adapters/stub-channel.adapter"
import type { BaseSupplierAdapter } from "@/lib/suppliers/base.adapter"
import type { SupplierContext } from "@/lib/suppliers/dto"
import { prisma } from "@/lib/prisma"

export function fulfillmentProviderToContext(
  provider: FulfillmentProvider
): SupplierContext {
  return {
    id: provider.id,
    slug: provider.slug,
    name: provider.name,
    type: provider.channelType,
    apiConfig: provider.apiConfig,
    credentialsEncrypted: provider.credentialsEncrypted,
    stripeConnectAccountId: provider.stripeConnectAccountId,
    slaHours: provider.slaHours,
  }
}

export function createSupplierAdapter(provider: FulfillmentProvider): BaseSupplierAdapter {
  const ctx = fulfillmentProviderToContext(provider)
  return createSupplierAdapterFromContext(ctx)
}

export function createSupplierAdapterFromContext(ctx: SupplierContext): BaseSupplierAdapter {
  switch (ctx.type) {
    case "AFFISELL_NATIVE":
      return new NativeSupplierAdapter(ctx)
    case "BLIND_REST":
      return new BlindRestSupplierAdapter(ctx)
    case "ALIEXPRESS":
      return new AliExpressSupplierAdapter(ctx)
    case "MANUAL":
      return new ManualSupplierAdapter(ctx)
    case "CJ_DROPSHIPPING":
    case "TEMU":
    case "BIGBUY":
    case "ZENDROP":
    case "AMAZON":
    case "TIKTOK_SHOP":
      return new StubChannelSupplierAdapter(ctx, ctx.type)
    default: {
      const _exhaustive: never = ctx.type
      return new NativeSupplierAdapter(ctx)
    }
  }
}

export async function loadSupplierAdapter(providerId: string): Promise<BaseSupplierAdapter> {
  const provider = await prisma.fulfillmentProvider.findUnique({ where: { id: providerId } })
  if (!provider) throw new Error(`fulfillment_provider_not_found:${providerId}`)
  return createSupplierAdapter(provider)
}

export function supportsSupplierApi(channel: SupplierChannelType): boolean {
  return createSupplierAdapterFromContext({
    id: "probe",
    slug: "probe",
    name: "probe",
    type: channel,
    apiConfig: {},
    credentialsEncrypted: null,
    slaHours: 24,
  }).supportsApi
}
