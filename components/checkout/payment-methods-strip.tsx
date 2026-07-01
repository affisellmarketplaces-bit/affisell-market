import { PaymentMethodBrandIcon } from "@/components/checkout/payment-method-brand-icons"
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
  /** Show subtle processor hint under the row */
  showProcessorHint?: boolean
  processorHint?: string
}

const tileByVariant: Record<Variant, string> = {
  footer:
    "border-white/20 bg-white/[0.97] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_24px_-12px_rgba(0,0,0,0.45)] hover:border-white/40 hover:shadow-[0_0_20px_-4px_rgba(196,181,253,0.55)]",
  light:
    "border-zinc-200/90 bg-white shadow-sm hover:border-violet-200 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-violet-500/30",
  compact:
    "border-zinc-200/80 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950",
}

export function PaymentMethodsStrip({
  className,
  variant = "footer",
  brands = paymentMethodBrandsForDisplay(),
  ariaLabel = "Accepted payment methods",
  showProcessorHint = false,
  processorHint = "Stripe",
}: Props) {
  if (brands.length === 0) return null

  const tile = cn(
    "flex h-9 w-[3.25rem] shrink-0 items-center justify-center overflow-hidden rounded-lg border p-1 transition duration-300 sm:h-10 sm:w-[3.5rem]",
    tileByVariant[variant]
  )

  return (
    <div className={cn("space-y-2.5", className)}>
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
      {showProcessorHint ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200/70">
          {processorHint}
        </p>
      ) : null}
    </div>
  )
}
