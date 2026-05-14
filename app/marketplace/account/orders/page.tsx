import Link from "next/link"
import { redirect } from "next/navigation"
import { CreditCard, ShoppingBag } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading } from "@/components/affisell/bento-ui"
import { auth } from "@/auth"
import { AccountOrdersClient } from "@/components/account/account-orders-client"
import { buttonVariants } from "@/components/ui/button"
import { buildBuyerOrdersPayloadForEmail } from "@/lib/account-orders-payload"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function MarketplaceBuyerOrdersPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/marketplace/account/orders")
  }

  const payload = await buildBuyerOrdersPayloadForEmail(session.user.email)

  return (
    <BentoContainer maxWidth="4xl" className="space-y-8">
      <BentoCard className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <BentoPageHeading
          eyebrow="Purchases"
          title="My orders"
          description="Request returns while your order is within the return window. After the seller approves, add tracking so they can confirm receipt and mark the refund as processed."
          className="max-w-xl"
        />
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            href="/marketplace/account/wallet"
            className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "inline-flex justify-center")}
          >
            <CreditCard className="size-5" aria-hidden />
            Store credit
          </Link>
          <Link
            href="/marketplace"
            className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex justify-center")}
          >
            <ShoppingBag className="size-5" aria-hidden />
            Continue shopping
          </Link>
        </div>
      </BentoCard>

      <AccountOrdersClient initialOrders={payload} />
    </BentoContainer>
  )
}
