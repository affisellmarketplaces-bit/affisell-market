import { redirect } from "next/navigation"

import { SponsorBoostStudio } from "@/components/sponsor/sponsor-boost-studio"
import { auth } from "@/auth"
import { listingDisplayTitle } from "@/lib/affiliate-listing-display"
import { loadAffiliateSponsorOptions } from "@/lib/sponsor/sponsor-catalog-options"

export default async function AffiliatePromotePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (session.user.role !== "AFFILIATE") redirect("/dashboard")

  const listings = await loadAffiliateSponsorOptions(session.user.id)
  const items = listings.map((row) => ({
    kind: "affiliate" as const,
    affiliateProductId: row.id,
    productId: row.product.id,
    label: listingDisplayTitle(row.customTitle, row.product.name),
    image: row.product.images[0] ?? null,
    htCents: row.product.basePriceCents,
  }))

  return (
    <div className="min-h-[calc(100dvh-3.75rem)] bg-zinc-100/90 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <SponsorBoostStudio role="AFFILIATE" items={items} />
      </div>
    </div>
  )
}
