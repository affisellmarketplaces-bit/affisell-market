import { AuctionArenaExperience } from "@/components/auctions/auction-arena-experience"
import { loadAuctionArena } from "@/lib/auctions-data.server"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Affisell Arena — Live auctions",
  description: "Futuristic live auctions on Affisell — bid on creator picks before they sell out.",
}

type PageProps = {
  searchParams: Promise<{ lot?: string }>
}

export default async function AuctionsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const payload = await loadAuctionArena()

  if (sp.lot?.trim()) {
    const lotId = sp.lot.trim()
    const idx = payload.lots.findIndex((l) => l.id === lotId)
    if (idx > 0) {
      const [picked] = payload.lots.splice(idx, 1)
      if (picked) payload.lots.unshift(picked)
    }
  }

  return <AuctionArenaExperience initial={payload} />
}
