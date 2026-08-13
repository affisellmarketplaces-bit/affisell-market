import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { storePublicUrl, storePublicUrlInputFromStore } from "@/lib/store-public-url"
import { syncStoreVercelDomainStatus } from "@/lib/store-domain-provisioning"
import { ensureStoreSubdomainReady, syncStoreSubdomainVercelStatus } from "@/lib/store-subdomain-provisioning"
import { isVercelDomainAutoProvisionEnabled } from "@/lib/vercel-project-domains"

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

  const store = await prisma.store.findUnique({ where: { userId } })
  if (!store) {
    return Response.json({ error: "No store" }, { status: 404 })
  }

  const merchantRole = role === "SUPPLIER" ? "SUPPLIER" : "AFFILIATE"

  if (isVercelDomainAutoProvisionEnabled() && store.subdomainVercelStatus !== "active") {
    try {
      await ensureStoreSubdomainReady(store.id, store.slug)
    } catch (e) {
      console.log("[store/domain-status]", {
        storeId: store.id,
        slug: store.slug,
        result: "subdomain_provision_error",
        error: e instanceof Error ? e.message : String(e),
      })
    }
  } else if (isVercelDomainAutoProvisionEnabled()) {
    await syncStoreSubdomainVercelStatus(store.id, store.slug).catch((e) => {
      console.log("[store/domain-status]", {
        storeId: store.id,
        result: "subdomain_sync_error",
        error: e instanceof Error ? e.message : String(e),
      })
    })
  }

  if (store.domainVerified && store.customDomain && isVercelDomainAutoProvisionEnabled()) {
    await syncStoreVercelDomainStatus(store.id)
    const refreshed = await prisma.store.findUnique({
      where: { id: store.id },
      select: {
        customDomain: true,
        domainVerified: true,
        vercelDomainStatus: true,
        vercelDomainError: true,
        vercelDomainSyncedAt: true,
      },
    })
    if (refreshed) {
      const latest = await prisma.store.findUnique({ where: { id: store.id } })
      const merged = latest ?? { ...store, ...refreshed }
      return Response.json({
        customDomain: merged.customDomain,
        domainVerified: merged.domainVerified,
        vercelDomainStatus: merged.vercelDomainStatus,
        vercelDomainError: merged.vercelDomainError,
        vercelDomainSyncedAt: merged.vercelDomainSyncedAt?.toISOString() ?? null,
        subdomainVercelStatus: merged.subdomainVercelStatus,
        subdomainVercelError: merged.subdomainVercelError,
        subdomainVercelSyncedAt: merged.subdomainVercelSyncedAt?.toISOString() ?? null,
        vercelAutoProvision: true,
        publicStoreUrl: storePublicUrl(storePublicUrlInputFromStore(merged, merchantRole)),
      })
    }
  }

  const refreshedStore = await prisma.store.findUnique({ where: { userId } })
  const latest = refreshedStore ?? store

  return Response.json({
    customDomain: latest.customDomain,
    domainVerified: latest.domainVerified,
    vercelDomainStatus: latest.vercelDomainStatus,
    vercelDomainError: latest.vercelDomainError,
    vercelDomainSyncedAt: latest.vercelDomainSyncedAt?.toISOString() ?? null,
    subdomainVercelStatus: latest.subdomainVercelStatus,
    subdomainVercelError: latest.subdomainVercelError,
    subdomainVercelSyncedAt: latest.subdomainVercelSyncedAt?.toISOString() ?? null,
    vercelAutoProvision: isVercelDomainAutoProvisionEnabled(),
    publicStoreUrl: storePublicUrl(storePublicUrlInputFromStore(latest, merchantRole)),
  })
}
