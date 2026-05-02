import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"

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

  const dnsTarget =
    typeof process.env.STORE_CNAME_TARGET === "string" && process.env.STORE_CNAME_TARGET.trim()
      ? process.env.STORE_CNAME_TARGET.trim()
      : "cname.affisell.com"

  return Response.json({ store, dnsTarget })
}
