import { redirect } from "next/navigation"

import { SponsorBoostStudio } from "@/components/sponsor/sponsor-boost-studio"
import { auth } from "@/auth"
import { loadSupplierSponsorOptions } from "@/lib/sponsor/sponsor-catalog-options"

export default async function SupplierPromotePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (session.user.role !== "SUPPLIER") redirect("/dashboard")

  const products = await loadSupplierSponsorOptions(session.user.id)
  const items = products.map((p) => ({
    kind: "supplier" as const,
    productId: p.id,
    label: p.name,
    image: p.images[0] ?? null,
    htCents: p.basePriceCents,
  }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SponsorBoostStudio role="SUPPLIER" items={items} />
    </div>
  )
}
