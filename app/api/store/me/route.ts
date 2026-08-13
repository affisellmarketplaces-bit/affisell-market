import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { getStoreCnameTarget } from "@/lib/store-cname-target"
import { prisma } from "@/lib/prisma"
import { storePublicUrl, resolveStorePublicUrls, storeHostSuffixForUi, storePublicUrlInputFromStore } from "@/lib/store-public-url"
import { ensureStoreSubdomainReady } from "@/lib/store-subdomain-provisioning"
import { isVercelDomainAutoProvisionEnabled } from "@/lib/vercel-project-domains"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let store = await prisma.store.findUnique({ where: { userId } })
  if (!store) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (!u) return Response.json({ error: "Not found" }, { status: 404 })
    store = await ensureMerchantStore({ userId, email: u.email, displayName: u.name })
  }

  if (isVercelDomainAutoProvisionEnabled() && store.subdomainVercelStatus !== "active") {
    try {
      await ensureStoreSubdomainReady(store.id, store.slug)
      store =
        (await prisma.store.findUnique({ where: { userId } })) ??
        store
    } catch (e) {
      console.log("[store/me]", {
        storeId: store.id,
        slug: store.slug,
        result: "subdomain_provision_error",
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const dnsTarget = getStoreCnameTarget()

  const merchantRole = role === "SUPPLIER" ? "SUPPLIER" : "AFFILIATE"
  const urlInput = storePublicUrlInputFromStore(store, merchantRole)
  const urls = resolveStorePublicUrls(urlInput)
  const publicStoreUrl = storePublicUrl(urlInput)

  let liveCatalogCount = 0
  let totalListingClicks = 0
  let totalListingConversions = 0
  if (merchantRole === "AFFILIATE") {
    const [listedCount, trafficAgg] = await Promise.all([
      prisma.affiliateProduct.count({
        where: { affiliateId: userId, isListed: true },
      }),
      prisma.affiliateProduct.aggregate({
        where: { affiliateId: userId },
        _sum: { clicks: true, conversions: true },
      }),
    ])
    liveCatalogCount = listedCount
    totalListingClicks = trafficAgg._sum.clicks ?? 0
    totalListingConversions = trafficAgg._sum.conversions ?? 0
  } else {
    liveCatalogCount = await prisma.product.count({
      where: { supplierId: userId, active: true, isDraft: false },
    })
  }

  return Response.json({
    store,
    dnsTarget,
    publicStoreUrl,
    storeUrls: urls,
    storeHostSuffix: storeHostSuffixForUi(),
    brandPulseMetrics: {
      liveCatalogCount,
      customDomainVerified: Boolean(store.customDomain && store.domainVerified),
      brandPulseLastScore: parseStorefrontTheme(store.storefrontTheme).brandOps?.brandPulseLastScore ?? null,
      totalListingClicks,
      totalListingConversions,
    },
  })
}
