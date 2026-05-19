import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { resolveLegacyMarketplaceIndexPath } from "@/lib/affiliate-routes"

export const dynamic = "force-dynamic"

/** Legacy URL — role-based redirect to affiliate catalog or public shops. */
export default async function MarketplaceIndexRedirectPage() {
  const session = await auth()
  const role = session?.user?.role
  redirect(resolveLegacyMarketplaceIndexPath(role))
}
