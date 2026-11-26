import { auth } from "@/auth"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { isReturnInspectionOutcome } from "@/lib/return-disposition"
import { recordReturnInspection } from "@/lib/return-disposition.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUS: Record<string, number> = { not_found: 404, forbidden: 403, not_received: 409, already_restocked: 409 }

/**
 * Supplier records the condition of returned goods: `{ "outcome": "resellable" | "damaged" | …, "note": "…" }`.
 * Records only; whether resellable goods go back to stock is `RETURN_RESTOCK_MODE` (off by default).
 */
export async function POST(req: Request, ctx: { params: Promise<{ returnId: string }> }): Promise<Response> {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Not authenticated" }, { status: 401 })
  if ((session.user as { role?: string }).role !== "SUPPLIER") return Response.json({ error: "Forbidden" }, { status: 403 })

  let body: { outcome?: unknown; note?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 })
  }
  if (!isReturnInspectionOutcome(body.outcome)) return Response.json({ error: "invalid_outcome" }, { status: 400 })
  const note = typeof body.note === "string" ? body.note.trim() : ""

  const { returnId } = await ctx.params
  const result = await recordReturnInspection({ returnId, supplierId: session.user.id, outcome: body.outcome, note })
  if (!result.ok) return Response.json({ error: result.error }, { status: STATUS[result.error] ?? 400 })
  return Response.json(result)
}
