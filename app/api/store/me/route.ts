import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { getStoreCnameTarget } from "@/lib/store-cname-target"
import { prisma } from "@/lib/prisma"
import { storePublicUrl, resolveStorePublicUrls, storeHostSuffixForUi } from "@/lib/store-public-url"

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

  const dnsTarget = getStoreCnameTarget()

  const merchantRole = role === "SUPPLIER" ? "SUPPLIER" : "AFFILIATE"
  const urlInput = {
    slug: store.slug,
    customDomain: store.customDomain,
    domainVerified: store.domainVerified,
    role: merchantRole as "SUPPLIER" | "AFFILIATE",
  }
  const urls = resolveStorePublicUrls(urlInput)
  const publicStoreUrl = storePublicUrl(urlInput)

  let liveCatalogCount = 0
  if (merchantRole === "AFFILIATE") {
    liveCatalogCount = await prisma.affiliateProduct.count({
      where: { affiliateId: userId, isListed: true },
    })
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
    },
  })
}
