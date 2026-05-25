import { z } from "zod"

import { auth } from "@/auth"
import { updateAffiliateSupplierInvitationById } from "@/lib/supplier-invitation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z
  .object({
    headline: z.string().max(120).optional(),
    personalMessage: z.string().max(2000).optional(),
    offeredCommissionPct: z.union([z.number(), z.string()]).optional(),
    categoryHint: z.string().max(80).optional(),
  })
  .strict()

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  const invitation = await updateAffiliateSupplierInvitationById(session.user.id, id, parsed.data)
  if (!invitation) {
    return Response.json({ error: "Not found or not editable" }, { status: 404 })
  }

  return Response.json({ invitation })
}
