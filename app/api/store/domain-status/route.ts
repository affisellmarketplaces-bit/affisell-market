import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { storePublicUrl } from "@/lib/store-public-url"
import { syncStoreVercelDomainStatus } from "@/lib/store-domain-provisioning"
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
      return Response.json({
        customDomain: refreshed.customDomain,
        domainVerified: refreshed.domainVerified,
        vercelDomainStatus: refreshed.vercelDomainStatus,
        vercelDomainError: refreshed.vercelDomainError,
        vercelDomainSyncedAt: refreshed.vercelDomainSyncedAt?.toISOString() ?? null,
        vercelAutoProvision: true,
        publicStoreUrl: storePublicUrl({
          slug: store.slug,
          customDomain: refreshed.customDomain,
          domainVerified: refreshed.domainVerified,
          role: merchantRole,
        }),
      })
    }
  }

  return Response.json({
    customDomain: store.customDomain,
    domainVerified: store.domainVerified,
    vercelDomainStatus: store.vercelDomainStatus,
    vercelDomainError: store.vercelDomainError,
    vercelDomainSyncedAt: store.vercelDomainSyncedAt?.toISOString() ?? null,
    vercelAutoProvision: isVercelDomainAutoProvisionEnabled(),
    publicStoreUrl: storePublicUrl({
      slug: store.slug,
      customDomain: store.customDomain,
      domainVerified: store.domainVerified,
      role: merchantRole,
    }),
  })
}
