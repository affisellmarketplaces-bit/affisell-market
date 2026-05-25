import { z } from "zod"

import { auth } from "@/auth"
import { isPrismaSchemaMissingError } from "@/lib/prisma-schema-error"
import {
  listSupplierAffiliateInvitations,
  upsertSupplierAffiliateInvitation,
} from "@/lib/supplier-affiliate-invitation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const bodySchema = z
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
  if (session.user.role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const invitations = await listSupplierAffiliateInvitations(session.user.id)
    return Response.json({ invitations })
  } catch (error) {
    console.error("[supplier/affiliate-invitations GET]", error)
    if (isPrismaSchemaMissingError(error)) {
      return Response.json(
        { error: "Feature pending database migration.", invitations: [], schemaPending: true },
        { status: 503 }
      )
    }
    return Response.json({ error: "Failed to load invitations" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (session.user.role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  try {
    const invitation = await upsertSupplierAffiliateInvitation(session.user.id, parsed.data)
    return Response.json({ invitation }, { status: 201 })
  } catch (error) {
    console.error("[supplier/affiliate-invitations POST]", error)
    if (isPrismaSchemaMissingError(error)) {
      return Response.json(
        { error: "Feature pending database migration.", schemaPending: true },
        { status: 503 }
      )
    }
    return Response.json({ error: "Failed to save invitation" }, { status: 500 })
  }
}
