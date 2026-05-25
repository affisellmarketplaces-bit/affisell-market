import { loadPublicSupplierInvitation } from "@/lib/supplier-invitation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Public invite metadata (view count recorded on SSR page, not here). */
export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params
  const invite = await loadPublicSupplierInvitation(token)
  if (!invite) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  return Response.json({ invite })
}
