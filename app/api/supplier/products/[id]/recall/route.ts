import { auth } from "@/auth"
import { recallSupplierProduct } from "@/lib/supplier-product-remove.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const result = await recallSupplierProduct(session.user.id, id)

  if (!result.ok) {
    const status =
      result.code === "not_found" ? 404 : result.code === "already_recalled" ? 409 : 400
    return Response.json({ error: result.message, code: result.code }, { status })
  }

  return Response.json({
    ok: true,
    listedAffiliatesUnlisted: result.listedAffiliatesUnlisted,
    auctionsCancelled: result.auctionsCancelled,
    notificationsSent: result.notificationsSent,
  })
}
