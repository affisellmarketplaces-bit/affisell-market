import { redirect } from "next/navigation"
import { requireAffiliateSession } from "@/lib/dashboard-session"

import { AffiliateProductEditForm } from "@/components/affiliate/affiliate-product-edit-form"
import { loginAffiliatePath } from "@/lib/login-redirect"

export const dynamic = "force-dynamic"

export default async function AffiliateProductEditPage() {
  const session = await requireAffiliateSession("/dashboard/affiliate/products/[id]/edit")


  return <AffiliateProductEditForm />
}
