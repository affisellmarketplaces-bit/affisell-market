import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
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

  return Response.json({ verified: true, message: "Domain verified" })
}
