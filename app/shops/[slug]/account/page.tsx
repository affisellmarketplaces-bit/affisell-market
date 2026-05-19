import { redirect } from "next/navigation"

/** Buyer account hub (shop context); orders live under marketplace account. */
export default async function ShopBuyerAccountPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await params
  redirect("/marketplace/account")
}
