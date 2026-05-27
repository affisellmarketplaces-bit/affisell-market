import { redirect } from "next/navigation"
import { requireMerchantSession } from "@/lib/dashboard-session"


export const dynamic = "force-dynamic"

export default async function WalletPage() {
  const session = await requireMerchantSession("/dashboard/wallet")

  const role = session.user.role
  if (role === "AFFILIATE") redirect("/dashboard/affiliate")
  redirect("/marketplace/account/wallet")
}
