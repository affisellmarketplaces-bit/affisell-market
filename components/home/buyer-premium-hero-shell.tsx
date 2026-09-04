import type { ReactNode } from "react"

import { BUYER_PREMIUM } from "@/lib/buyer-premium-home-tokens"

type Props = {
  children: ReactNode
}

/** Hero zone — orbs over body atmosphere; nav sits on same Affisell canvas. */
export function BuyerPremiumHeroShell({ children }: Props) {
  return (
    <div className="buyer-premium-hero-bleed relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: BUYER_PREMIUM.hero.gradient }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -left-32 -top-16 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ backgroundColor: BUYER_PREMIUM.hero.orbLeft }}
        />
        <div
          className="absolute -bottom-24 -right-32 h-[30rem] w-[30rem] rounded-full blur-3xl"
          style={{ backgroundColor: BUYER_PREMIUM.hero.orbRight }}
        />
        <div
          className="absolute left-1/2 top-[12%] h-64 w-[min(110%,42rem)] -translate-x-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: BUYER_PREMIUM.hero.orbCenter }}
        />
        <div
          className="absolute -left-10 top-0 h-40 w-[45%] rounded-full blur-2xl"
          style={{ backgroundColor: BUYER_PREMIUM.hero.shine }}
        />
        <div
          className="absolute -right-10 top-0 h-44 w-[48%] rounded-full blur-2xl"
          style={{ backgroundColor: "rgba(147, 51, 234, 0.22)" }}
        />
      </div>
      <div className="relative mx-auto w-full min-w-0 max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14 md:pb-16">
        {children}
      </div>
    </div>
  )
}
