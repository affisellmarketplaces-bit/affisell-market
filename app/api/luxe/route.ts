import { loadLuxuryAtelier } from "@/lib/luxury-data.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const payload = await loadLuxuryAtelier()
  return Response.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  })
}
