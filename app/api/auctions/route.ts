import { loadAuctionArena } from "@/lib/auctions-data.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const payload = await loadAuctionArena()
  return Response.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  })
}
