import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { provisionStoreCustomDomainOnVercel } from "@/lib/store-domain-provisioning"
import { isVercelDomainAutoProvisionEnabled } from "@/lib/vercel-project-domains"
import { customDomainPointsToAffisell } from "@/lib/verify-store-domain"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TARGET =
  typeof process.env.STORE_CNAME_TARGET === "string" && process.env.STORE_CNAME_TARGET.trim()
    ? process.env.STORE_CNAME_TARGET.trim()
    : "cname.affisell.com"

export async function POST() {
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
  if (!store?.customDomain) {
    return Response.json({ error: "Save a custom domain first" }, { status: 400 })
  }

  const ok = await customDomainPointsToAffisell(store.customDomain, TARGET)
  if (!ok) {
    return Response.json({
      verified: false,
      message: `We could not find a CNAME for ${store.customDomain} pointing to ${TARGET}. DNS changes may take up to 48 hours.`,
    })
  }

  await prisma.store.update({
    where: { id: store.id },
    data: { domainVerified: true },
  })

  let vercel: {
    status: string
    message?: string
    autoProvisionEnabled: boolean
  } | null = null

  if (isVercelDomainAutoProvisionEnabled()) {
    const result = await provisionStoreCustomDomainOnVercel(store.id, store.customDomain)
    vercel = {
      status: result.status,
      message: result.message,
      autoProvisionEnabled: true,
    }
  } else {
    await prisma.store.update({
      where: { id: store.id },
      data: {
        vercelDomainStatus: "skipped",
        vercelDomainError: null,
        vercelDomainSyncedAt: new Date(),
      },
    })
    vercel = {
      status: "skipped",
      message: "Add this hostname manually in Vercel → Project → Domains for SSL.",
      autoProvisionEnabled: false,
    }
  }

  return Response.json({
    verified: true,
    message:
      vercel?.status === "active"
        ? "Domain verified. SSL is active on Vercel."
        : vercel?.status === "pending"
          ? "Domain verified. SSL on Vercel is pending (DNS can take up to 48h)."
          : "Domain verified. Configure Vercel Domains if HTTPS is not live yet.",
    vercel,
  })
}
