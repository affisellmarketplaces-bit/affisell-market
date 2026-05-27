import { redirect } from "next/navigation"

import { AffiliateProductEditForm } from "@/components/affiliate/affiliate-product-edit-form"
import { auth } from "@/auth"
import { loginAffiliatePath } from "@/lib/login-redirect"

export const dynamic = "force-dynamic"

export default async function AffiliateProductEditPage() {
  const session = await auth()
  if (!session?.user?.id) redirect(loginAffiliatePath("/dashboard/affiliate"))
  if (session.user.role !== "AFFILIATE" && session.user.role !== "ADMIN") {
    redirect("/dashboard/affiliate")
  }

  return <AffiliateProductEditForm />
}
