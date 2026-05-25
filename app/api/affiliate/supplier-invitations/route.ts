import { z } from "zod"

import { auth } from "@/auth"
import {
  listAffiliateSupplierInvitations,
  upsertAffiliateSupplierInvitation,
} from "@/lib/supplier-invitation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const createSchema = z
  .object({
    headline: z.string().max(120).optional(),
    personalMessage: z.string().max(2000).optional(),
    offeredCommissionPct: z.union([z.number(), z.string()]).optional(),
    categoryHint: z.string().max(80).optional(),
  })
  .strict()

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const invitations = await listAffiliateSupplierInvitations(session.user.id)
  return Response.json({ invitations })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  const invitation = await upsertAffiliateSupplierInvitation(session.user.id, parsed.data)
  return Response.json({ invitation }, { status: 201 })
}
