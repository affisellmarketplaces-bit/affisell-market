import { ListingReplacementPanel } from "@/components/affiliate/listing-replacement-panel"
import { ShopDemandPanel } from "@/components/affiliate/shop-demand-panel"
import { requireAffiliateSession } from "@/lib/dashboard-session"

export const dynamic = "force-dynamic"

/**
 * Withdraw or replace an unsellable product of the reseller's shop — every figure comes from the API. With
 * `?variant=<key>` (from the « buyers are waiting » action), the shop's demand for that exact variant and the
 * alternatives that really offer it come first.
 */
export default async function AffiliateListingReplacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ variant?: string | string[] }>
}) {
  const { id } = await params
  const sp = await searchParams
  const variant = typeof sp.variant === "string" ? sp.variant.slice(0, 400) : ""
  await requireAffiliateSession(`/dashboard/affiliate/products/${encodeURIComponent(id)}/replace`)
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {variant ? <ShopDemandPanel listingId={id} variantKey={variant} /> : null}
      <ListingReplacementPanel listingId={id} />
    </main>
  )
}
