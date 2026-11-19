import { ListingReplacementPanel } from "@/components/affiliate/listing-replacement-panel"
import { requireAffiliateSession } from "@/lib/dashboard-session"

export const dynamic = "force-dynamic"

/** Withdraw or replace an unsellable product of the reseller's shop — every figure comes from the API. */
export default async function AffiliateListingReplacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAffiliateSession(`/dashboard/affiliate/products/${encodeURIComponent(id)}/replace`)
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ListingReplacementPanel listingId={id} />
    </main>
  )
}
