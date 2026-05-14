import { redirect } from "next/navigation"

import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function WalletPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/marketplace/account/wallet")
  }
  const role = session.user.role
  if (role === "AFFILIATE") redirect("/dashboard/affiliate")
  if (role === "SUPPLIER") redirect("/dashboard/supplier")
  redirect("/marketplace/account/wallet")
}
