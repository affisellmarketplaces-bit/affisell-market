import { auth } from "@/auth"
import { LuxuryAtelierExperience } from "@/components/luxury/luxury-atelier-experience"
import { loadLuxuryAtelier } from "@/lib/luxury-data.server"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Affisell Luxe — Atelier",
  description: "Sélection curatoriale Luxe et collections Affisell — expérience futuriste.",
}

type PageProps = {
  searchParams: Promise<{ collection?: string; piece?: string }>
}

function isLuxeMerchantHintRole(role: string | undefined | null): boolean {
  return role === "SUPPLIER" || role === "AFFILIATE"
}

export default async function LuxePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const session = await auth()
  const showMerchantHint = isLuxeMerchantHintRole(
    (session?.user as { role?: string } | undefined)?.role
  )
  const payload = await loadLuxuryAtelier()

  const collectionSlug = sp.collection?.trim() || null
  const pieceId = sp.piece?.trim() || null

  if (pieceId) {
    const idx = payload.pieces.findIndex((p) => p.listingId === pieceId)
    if (idx > 0) {
      const [picked] = payload.pieces.splice(idx, 1)
      if (picked) payload.pieces.unshift(picked)
      payload.featuredListingId = picked.listingId
    }
  }

  return (
    <LuxuryAtelierExperience
      initial={payload}
      initialCollectionSlug={collectionSlug}
      showMerchantHint={showMerchantHint}
    />
  )
}
