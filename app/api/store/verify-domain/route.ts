import { auth } from "@/auth"
import { activateStoreCustomDomainIfReady } from "@/lib/store-custom-domain-activation"
import { isVercelDomainAutoProvisionEnabled } from "@/lib/vercel-project-domains"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

  const { prisma } = await import("@/lib/prisma")
  const store = await prisma.store.findUnique({ where: { userId } })
  if (!store?.customDomain) {
    return Response.json({ error: "Save a custom domain first" }, { status: 400 })
  }

  const result = await activateStoreCustomDomainIfReady(store.id)

  if (!result.dnsReady) {
    return Response.json({
      verified: false,
      message: result.message,
    })
  }

  const verified = result.domainVerified
  let message = result.message ?? "Domain verified."
  if (result.vercelStatus === "active") {
    message = "Domain verified. SSL is active on Vercel."
  } else if (result.vercelStatus === "pending") {
    message = "Domain verified. SSL on Vercel is pending (usually within 30 min)."
  } else if (result.vercelStatus === "skipped") {
    message = "Domain verified. Platform auto-SSL is not configured — contact support if HTTPS fails."
  }

  return Response.json({
    verified,
    message,
    vercel: {
      status: result.vercelStatus,
      message: result.message,
      autoProvisionEnabled: isVercelDomainAutoProvisionEnabled(),
    },
  })
}
