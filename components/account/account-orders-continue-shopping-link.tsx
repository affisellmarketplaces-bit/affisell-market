"use client"

import Link from "next/link"
import { ShoppingBag, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import { readBuyerPersonalizationRefreshPending } from "@/lib/buyer-personalization-refresh.client"
import { cn } from "@/lib/utils"

/** After checkout, steer the buyer back to the personalized explorer instead of generic browse. */
export function AccountOrdersContinueShoppingLink() {
  const [postCheckout, setPostCheckout] = useState(false)

  useEffect(() => {
    setPostCheckout(readBuyerPersonalizationRefreshPending() === "checkout_success")
  }, [])

  const href = postCheckout ? "/#explorer" : "/shops/browse"
  const label = postCheckout ? "Recommended for you" : "Continue shopping"
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
