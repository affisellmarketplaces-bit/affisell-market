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
    <div className="min-h-[calc(100dvh-3.75rem)] bg-zinc-100/90 px-4 py-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">
        <SponsorBoostStudio role="SUPPLIER" items={items} />
      </div>
    </div>
  )
}
