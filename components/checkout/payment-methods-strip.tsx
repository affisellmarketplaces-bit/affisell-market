import { PaymentMethodBrandIcon } from "@/components/checkout/payment-method-brand-icons"
import { PaymentStripeProcessorBadge } from "@/components/checkout/payment-stripe-processor-badge"
import {
  paymentMethodBrandLabel,
  paymentMethodBrandsForDisplay,
  type PaymentMethodBrandId,
} from "@/lib/payment-method-brands"
import { cn } from "@/lib/utils"

type Variant = "footer" | "light" | "compact"

type Props = {
  className?: string
  variant?: Variant
  brands?: PaymentMethodBrandId[]
  ariaLabel?: string
  /** Lead with prominent Stripe badge (recommended on trust surfaces). */
  showStripeLead?: boolean
  processorSecureLabel?: string
}

const tileByVariant: Record<Variant, string> = {
  footer:
    "border-white/20 bg-white/[0.97] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_24px_-12px_rgba(0,0,0,0.45)] hover:border-white/40 hover:shadow-[0_0_20px_-4px_rgba(196,181,253,0.55)]",
  light:
    "border-zinc-200/90 bg-white shadow-sm hover:border-violet-200 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-violet-500/30",
  compact:
    "border-zinc-200/80 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950",
}

const dividerByVariant: Record<Variant, string> = {
  footer: "bg-white/20",
  light: "bg-zinc-200 dark:bg-zinc-700",
  compact: "bg-zinc-200 dark:bg-zinc-700",
}

export function PaymentMethodsStrip({
  className,
  variant = "footer",
  brands = paymentMethodBrandsForDisplay(),
  ariaLabel = "Accepted payment methods",
  showStripeLead = true,
  processorSecureLabel = "3D Secure",
}: Props) {
  if (brands.length === 0 && !showStripeLead) return null

  const tile = cn(
    "flex h-9 w-[3.25rem] shrink-0 items-center justify-center overflow-hidden rounded-lg border p-1 transition duration-300 sm:h-10 sm:w-[3.5rem]",
    tileByVariant[variant]
  )

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        {showStripeLead ? (
          <PaymentStripeProcessorBadge
            variant={variant}
            secureLabel={processorSecureLabel}
          />
        ) : null}

        {showStripeLead && brands.length > 0 ? (
          <span
            className={cn("hidden h-10 w-px shrink-0 sm:block", dividerByVariant[variant])}
            aria-hidden
          />
        ) : null}

        {brands.length > 0 ? (
          <ul
            className="flex flex-wrap items-center gap-2"
            role="list"
            aria-label={ariaLabel}
          >
            {brands.map((brand) => (
              <li key={brand} role="listitem">
                <span className={tile} title={paymentMethodBrandLabel(brand)}>
                  <PaymentMethodBrandIcon brand={brand} className="max-h-7 w-auto" />
                  <span className="sr-only">{paymentMethodBrandLabel(brand)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
