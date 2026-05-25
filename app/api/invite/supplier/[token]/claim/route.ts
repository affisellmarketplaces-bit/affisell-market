import { auth } from "@/auth"
import { claimSupplierInvitationForUser } from "@/lib/supplier-invitation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (session.user.role !== "SUPPLIER") {
    return Response.json({ error: "Supplier account required" }, { status: 403 })
  }

  const { token } = await context.params
  const result = await claimSupplierInvitationForUser(token, session.user.id)

  if (!result.ok) {
    const status =
      result.reason === "not_found_or_expired"
        ? 404
        : result.reason === "taken" || result.reason === "already_linked"
          ? 409
          : 400
    return Response.json({ error: result.reason }, { status })
  }

  return Response.json({ ok: true, invitationId: result.invitationId })
}
