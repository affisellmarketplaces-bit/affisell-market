import { auth } from "@/auth"
import { assertSameSiteRequestOrigin } from "@/lib/request-origin-guard"
import { isReturnDecision } from "@/lib/return-disposition"
import { decideReturnDisposition, loadReturnDispositionTimeline } from "@/lib/return-disposition.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUS: Record<string, number> = {
  not_found: 404,
  forbidden: 403,
  not_received: 409,
  already_restocked: 409,
  not_inspected: 409,
  not_resellable: 409,
}

async function supplierId(): Promise<string | Response> {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Not authenticated" }, { status: 401 })
  if ((session.user as { role?: string }).role !== "SUPPLIER") return Response.json({ error: "Forbidden" }, { status: 403 })
  return session.user.id
}

/** Supplier: the traced steps of a return's goods (received → inspected → decided → restocked) and its stage. */
export async function GET(_req: Request, ctx: { params: Promise<{ returnId: string }> }): Promise<Response> {
  const id = await supplierId()
  if (typeof id !== "string") return id
  const { returnId } = await ctx.params
  const timeline = await loadReturnDispositionTimeline(returnId, id)
  if (!timeline) return Response.json({ error: "not_found" }, { status: 404 })
  return Response.json(timeline)
}

/**
 * Supplier validates what to do with inspected goods: `{ "decision": "restock" | "keep_out", "note": "…" }`.
 * A restock needs a `resellable` latest inspection; it applies to stock only per RETURN_RESTOCK_MODE (off by default).
 */
export async function POST(req: Request, ctx: { params: Promise<{ returnId: string }> }): Promise<Response> {
  const originBlock = assertSameSiteRequestOrigin(req)
  if (originBlock) return originBlock
  const id = await supplierId()
  if (typeof id !== "string") return id
  let body: { decision?: unknown; note?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 })
  }
  if (!isReturnDecision(body.decision)) return Response.json({ error: "invalid_decision" }, { status: 400 })
  const note = typeof body.note === "string" ? body.note.trim() : ""
  const { returnId } = await ctx.params
  const result = await decideReturnDisposition({ returnId, supplierId: id, decision: body.decision, note })
  if (!result.ok) return Response.json({ error: result.error }, { status: STATUS[result.error] ?? 400 })
  return Response.json(result)
}
