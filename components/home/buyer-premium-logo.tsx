import { cn } from "@/lib/utils"
import { BUYER_PREMIUM } from "@/lib/buyer-premium-home-tokens"

type Props = {
  className?: string
  showWordmark?: boolean
}

/** Affisell wordmark + gradient tile (buyer premium nav). */
export function BuyerPremiumLogo({ className, showWordmark = true }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
        style={{
          background: BUYER_PREMIUM.logo.gradient,
          boxShadow: BUYER_PREMIUM.logo.shadow,
        }}
        aria-hidden
      >
        A
      </span>
      {showWordmark ? (
        <span
          className="text-lg font-bold tracking-tight dark:text-white"
          style={{ color: BUYER_PREMIUM.text.heading }}
        >
          Affisell
        </span>
      ) : null}
    </span>
  )
}
