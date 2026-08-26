import { z } from "zod"

import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { kycSupplier, listAllSuppliersWithKyc, listKycChecksForSupplier } from "@/lib/legal/kyc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const postSchema = z
  .object({
    supplierId: z.string().min(1),
    siret: z.string().optional(),
    tva: z.string().optional(),
  })
  .strict()

export async function POST(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  try {
    const body = postSchema.parse(await req.json())
    const result = await kycSupplier(body)
    return Response.json({ ok: true, kyc: result })
  } catch (error) {
    console.error("[legal:kyc]", {
      stage: "verify",
      error: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "verify_failed" }, { status: 400 })
  }
}

export async function GET(req: Request) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  const url = new URL(req.url)
  const path = url.pathname

  if (path.endsWith("/all") || url.searchParams.get("all") === "true") {
    const suppliers = await listAllSuppliersWithKyc()
    return Response.json({ ok: true, suppliers })
  }

  const supplierId = url.searchParams.get("supplierId")?.trim()
  if (!supplierId) {
    return Response.json({ ok: false, error: "supplierId_required" }, { status: 400 })
  }

  const checks = await listKycChecksForSupplier(supplierId)
  return Response.json({ ok: true, checks })
}
