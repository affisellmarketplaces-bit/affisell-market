"use client"

import Link from "next/link"
import { ShoppingBag, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import { usePostCheckoutRecommendedPicks } from "@/components/account/account-orders-shopping-cta.client"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** After checkout, steer the buyer back to the personalized explorer instead of generic browse. */
export function AccountOrdersContinueShoppingLink() {
  const t = useTranslations("accountOrders")
  const tPersonalized = useTranslations("marketplace.browse.personalized")
  const postCheckout = usePostCheckoutRecommendedPicks()

  const href = postCheckout ? "/#explorer" : "/shops/browse"
  const label = postCheckout ? tPersonalized("titleForYou") : t("continueShopping")
  const Icon = postCheckout ? Sparkles : ShoppingBag
  const variant = postCheckout ? "bentoAccent" : "bentoSolid"

  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size: "bento" }), "inline-flex justify-center")}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  )
}
