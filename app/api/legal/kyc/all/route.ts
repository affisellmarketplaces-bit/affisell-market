import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { listAllSuppliersWithKyc } from "@/lib/legal/kyc"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return Response.json({ error: gate.error }, { status: gate.status })
  }

  const suppliers = await listAllSuppliersWithKyc()
  return Response.json({ ok: true, suppliers })
}
