import { loadPublicAffiliateInvitation } from "@/lib/supplier-affiliate-invitation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params
  const invite = await loadPublicAffiliateInvitation(token)
  if (!invite) {
    return Response.json({ error: "not_found" }, { status: 404 })
  }
  return Response.json({ invite })
}
