import { getAliExpressConfigStatus } from "@/lib/aliexpress-config"
import { prisma } from "@/lib/prisma"
import {
  SUPPLY_HUB_CHANNEL_DEFS,
  resolveAliExpressUiStatus,
  resolveBlindRestUiStatus,
  type SupplyConnectorUiStatus,
  type SupplyHubConnectorSnapshot,
  type SupplyHubSnapshot,
} from "@/lib/supplier/supply-hub-shared"

/** Read-only Supply Hub metrics for supplier dashboard (no side effects). */
export async function loadSupplyHubSnapshot(supplierId: string): Promise<SupplyHubSnapshot> {
  const platformAliExpressConfigured = getAliExpressConfigStatus().configured

  const oneboundConfigured = Boolean(process.env.ONEBOUND_KEY?.trim())

  const [
    aliexpressSkuCount,
    alibaba1688SkuCount,
    autoBuyLinkCount,
    nativeSkuCount,
    manualSkuCount,
    webhookIntegrationCount,
    blindPartner,
    fulfillmentProviders,
  ] = await Promise.all([
    prisma.product.count({
      where: {
        supplierId,
        OR: [
          { importSource: "aliexpress" },
          { aliexpressProductId: { not: null } },
        ],
      },
    }),
    prisma.product.count({
      where: {
        supplierId,
        OR: [
          { importSource: "1688" },
          { sourceUrl: { contains: "1688.com" } },
        ],
      },
    }),
    prisma.supplierLink.count({
      where: {
        autoBuyEnabled: true,
        isActive: true,
        product: { supplierId },
      },
    }),
    prisma.product.count({
      where: {
        supplierId,
        fulfillmentChannel: "AFFISELL_NATIVE",
      },
    }),
    prisma.product.count({
      where: {
        supplierId,
        fulfillmentChannel: "MANUAL",
      },
    }),
    prisma.supplierIntegration.count({
      where: { userId: supplierId, enabled: true },
    }),
    prisma.blindDropshipSupplier.findUnique({
      where: { linkedUserId: supplierId },
      select: {
        isBlindDropship: true,
        apiType: true,
        apiEndpoint: true,
      },
    }),
    prisma.fulfillmentProvider.findMany({
      where: { supplierUserId: supplierId },
      select: { channelType: true, status: true },
    }),
  ])

  const blindRestEndpoint =
    Boolean(blindPartner?.isBlindDropship) &&
    blindPartner?.apiType === "rest" &&
    Boolean(blindPartner.apiEndpoint?.trim())

  const blindLinkedSkus = blindRestEndpoint
    ? await prisma.product.count({
        where: {
          supplierId,
          supplierSku: { not: null },
          NOT: { supplierSku: "" },
        },
      })
    : 0

  const activeProviderTypes = new Set(
    fulfillmentProviders.filter((p) => p.status === "ACTIVE").map((p) => p.channelType)
  )

  const connectors: SupplyHubConnectorSnapshot[] = SUPPLY_HUB_CHANNEL_DEFS.map((def) => {
    let uiStatus: SupplyConnectorUiStatus = "roadmap"
    let hintKey: string | undefined
    const stats: SupplyHubConnectorSnapshot["stats"] = {}

    switch (def.channelType) {
      case "AFFISELL_NATIVE":
        uiStatus = nativeSkuCount > 0 ? "native" : "setup"
        stats.linkedSkus = nativeSkuCount
        break
      case "ALIEXPRESS": {
        uiStatus = resolveAliExpressUiStatus({
          platformConfigured: platformAliExpressConfigured,
          linkedSkus: aliexpressSkuCount,
          autoBuySkus: autoBuyLinkCount,
        })
        stats.linkedSkus = aliexpressSkuCount
        stats.autoBuySkus = autoBuyLinkCount
        if (!platformAliExpressConfigured) hintKey = "aliexpressPlatform"
        else if (autoBuyLinkCount === 0) hintKey = "aliexpressAutoBuy"
        break
      }
      case "ALIBABA_1688":
        uiStatus = oneboundConfigured
          ? alibaba1688SkuCount > 0
            ? "connected"
            : "setup"
          : "roadmap"
        stats.linkedSkus = alibaba1688SkuCount
        hintKey = oneboundConfigured ? "alibaba1688Import" : "alibaba1688Key"
        break
      case "BLIND_REST":
        uiStatus = resolveBlindRestUiStatus({
          hasRestEndpoint: blindRestEndpoint,
          linkedSkus: blindLinkedSkus,
        })
        stats.linkedSkus = blindLinkedSkus
        stats.hasRestEndpoint = blindRestEndpoint
        stats.webhookIntegrations = webhookIntegrationCount
        if (!blindRestEndpoint) hintKey = "factoryRest"
        break
      case "BIGBUY":
      case "CJ_DROPSHIPPING":
      case "AMAZON":
        uiStatus = activeProviderTypes.has(def.channelType) ? "setup" : "roadmap"
        break
      case "MANUAL":
        uiStatus = manualSkuCount > 0 ? "connected" : "setup"
        stats.linkedSkus = manualSkuCount
        break
      default:
        uiStatus = "roadmap"
    }

    return {
      channelType: def.channelType,
      labelKey: def.labelKey,
      uiStatus,
      phase: def.phase,
      capabilities: def.capabilities,
      href: def.href,
      stats: Object.keys(stats).length > 0 ? stats : undefined,
      hintKey,
    }
  })

  const catalogSkus = await prisma.product.count({ where: { supplierId } })

  console.log("[supply-hub]", {
    supplierId,
    catalogSkus,
    autoBuySkus: autoBuyLinkCount,
    aliexpressSkuCount,
    platformAliExpressConfigured,
  })

  return {
    connectors,
    totals: {
      catalogSkus,
      autoBuySkus: autoBuyLinkCount,
      platformSyncEnabled: webhookIntegrationCount,
    },
    platformAliExpressConfigured,
  }
}
