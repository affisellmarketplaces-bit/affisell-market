import { auth } from "@/auth"
import { bulkDeleteSupplierDrafts } from "@/lib/supplier-delete-drafts.server"
import { normalizeSupplierBulkDeleteDraftIds } from "@/lib/supplier-delete-drafts-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const ids =
    body !== null && typeof body === "object" && "ids" in body
      ? normalizeSupplierBulkDeleteDraftIds((body as { ids: unknown }).ids)
      : []

  if (ids.length === 0) {
    return Response.json({ error: "Aucun brouillon sélectionné." }, { status: 400 })
  }

  const result = await bulkDeleteSupplierDrafts(session.user.id, ids)
  return Response.json(result)
}
