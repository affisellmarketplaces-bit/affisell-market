import { ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"

type Variant = "footer" | "light" | "compact"

type Props = {
  variant?: Variant
  secureLabel?: string
  className?: string
}

function StripeWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 72 30"
      className={cn("h-[1.125rem] w-auto sm:h-5", className)}
      role="img"
      aria-label="Stripe"
    >
      <text
        x="0"
        y="23"
        fill="currentColor"
        fontSize="24"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        letterSpacing="-0.6"
      >
        Stripe
      </text>
    </svg>
  )
}

const leadTileByVariant: Record<Variant, string> = {
  footer:
    "border-white/30 bg-white shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_10px_28px_-10px_rgba(99,91,255,0.55)] ring-1 ring-white/40",
  light:
    "border-[#635BFF]/25 bg-white shadow-md ring-1 ring-[#635BFF]/15 dark:border-[#635BFF]/35 dark:bg-zinc-950",
  compact: "border-zinc-200/90 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950",
}

const secureChipByVariant: Record<Variant, string> = {
  footer:
    "border-emerald-300/45 bg-emerald-400/15 text-emerald-100 shadow-[0_0_20px_-8px_rgba(52,211,153,0.65)]",
  light:
    "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
  compact:
    "border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200",
}

const wordmarkColorByVariant: Record<Variant, string> = {
  footer: "text-[#635BFF]",
  light: "text-[#635BFF]",
  compact: "text-[#635BFF]",
}

/** Prominent Stripe processor badge — always first in payment trust rows. */
export function PaymentStripeProcessorBadge({
  variant = "footer",
  secureLabel = "3D Secure",
  className,
}: Props) {
  return (
    <div className={cn("flex shrink-0 flex-wrap items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex h-11 min-w-[6.25rem] items-center justify-center rounded-2xl border px-4 sm:h-12 sm:min-w-[6.75rem] sm:px-5",
          leadTileByVariant[variant]
        )}
      >
        <StripeWordmark className={wordmarkColorByVariant[variant]} />
      </span>
      {secureLabel ? (
        <span
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] sm:h-10 sm:px-3",
            secureChipByVariant[variant]
          )}
        >
          <ShieldCheck className="size-3.5 shrink-0 opacity-90" aria-hidden />
          {secureLabel}
        </span>
      ) : null}
    </div>
  )
}
