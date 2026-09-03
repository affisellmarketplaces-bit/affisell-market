import { requireAffiliateSession } from "@/lib/dashboard-session"

import { AffiliateProductEditForm } from "@/components/affiliate/affiliate-product-edit-form"

export const dynamic = "force-dynamic"

export default async function AffiliateProductEditPage() {
  await requireAffiliateSession("/dashboard/affiliate/products/[id]/edit")


  return <AffiliateProductEditForm />
}
