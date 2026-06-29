import { redirect } from "next/navigation"

type Props = { params: Promise<{ id: string }> }

/** Canonical buyer order URL — redirects to marketplace account detail. */
export default async function BuyerOrderRedirectPage({ params }: Props) {
  const { id } = await params
  redirect(`/marketplace/account/orders/${id}`)
}
