import { auth } from "@/auth"
import { findSupplierProductDuplicates } from "@/lib/listing-compliance/duplicates.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const clip = (v: string | null, max: number) => (v ? v.slice(0, max) : null)

/** Advisory check while a supplier fills the form: does one of their other products look the same? */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Not authenticated" }, { status: 401 })
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const sp = new URL(req.url).searchParams
  try {
    const duplicates = await findSupplierProductDuplicates({
      supplierId: session.user.id,
      gtin: clip(sp.get("gtin"), 40),
      name: clip(sp.get("name"), 500),
      imageUrl: clip(sp.get("image"), 2000),
      excludeId: clip(sp.get("excludeId"), 64),
    })
    return Response.json({ duplicates })
  } catch (e) {
    // An advisory helper must never get in the way of filling the form.
    console.error("[duplicate-check]", e instanceof Error ? e.message : e)
    return Response.json({ duplicates: [] })
  }
}
