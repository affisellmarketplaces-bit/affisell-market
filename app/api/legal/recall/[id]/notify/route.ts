import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { notifyCustomersRecall } from "@/lib/legal/gpsr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Props) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  const { id } = await params

  try {
    const result = await notifyCustomersRecall(id)
    return Response.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "notify_failed"
    console.error("[legal:recall:notify]", { recallId: id, error: message })
    const status = message.includes("not_found") ? 404 : 400
    return Response.json({ ok: false, error: message }, { status })
  }
}
