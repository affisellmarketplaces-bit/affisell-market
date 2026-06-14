import Link from "next/link"
import { ChevronRight, Package } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  href: string
  label: string
  hint?: string
  actionLabel?: string
  variant?: "supplier" | "affiliate"
  className?: string
}

export function MerchantMyCatalogCue({
  href,
  label,
  hint,
  actionLabel = "Open",
  variant = "supplier",
  className,
}: Props) {
  const accentBorder =
    variant === "affiliate"
      ? "border-emerald-500/15 hover:border-emerald-400/30"
      : "border-violet-500/15 hover:border-violet-400/30"

  const accentBar =
    variant === "affiliate"
      ? "from-emerald-400/90 via-emerald-500/40 to-transparent"
      : "from-violet-400/90 via-violet-500/40 to-transparent"

  const accentGlow =
    variant === "affiliate"
      ? "from-emerald-500/8 via-transparent to-transparent group-hover:from-emerald-500/12"
      : "from-violet-500/8 via-transparent to-transparent group-hover:from-violet-500/12"

  return (
    <Link
      href={href}
      className={cn(
        "group relative mt-3 flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-lg",
        "border border-white/10 bg-zinc-950/85 px-2.5 backdrop-blur-xl sm:px-3",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.05)]",
        "transition duration-200 hover:bg-zinc-950/95 active:scale-[0.998]",
        accentBorder,
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b",
          accentBar
        )}
        aria-hidden
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-r opacity-100 transition duration-300",
          accentGlow
        )}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        aria-hidden
      />

      <span
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center rounded-md",
          "border border-white/10 bg-white/[0.04] transition duration-200",
          "group-hover:border-white/15 group-hover:bg-white/[0.07]"
        )}
      >
        <Package className="size-3.5 text-zinc-300" aria-hidden />
      </span>

      <span className="relative flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-100">
          {label}
        </span>
        {hint ? (
          <>
            <span className="hidden shrink-0 text-zinc-600 sm:inline" aria-hidden>
              ·
            </span>
            <span className="hidden min-w-0 truncate text-[10px] font-medium text-zinc-500 sm:inline">
              {hint}
            </span>
          </>
        ) : null}
      </span>

      <span
        className={cn(
          "relative ml-auto hidden shrink-0 items-center gap-0.5",
          "text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500",
          "transition duration-200 group-hover:text-zinc-300 sm:inline-flex"
        )}
      >
        {actionLabel}
        <ChevronRight
          className="size-3.5 transition duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>

      <ChevronRight
        className="relative ml-auto size-3.5 shrink-0 text-zinc-500 transition duration-200 group-hover:translate-x-0.5 group-hover:text-zinc-300 sm:hidden"
        aria-hidden
      />
    </Link>
  )
}
