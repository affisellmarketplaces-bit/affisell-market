import Link from "next/link"
import { ChevronRight, Package } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  href: string
  label: string
  hint?: string
  metrics?: string
  actionLabel?: string
  variant?: "supplier" | "affiliate"
  surface?: "light" | "dark"
  className?: string
}

export function MerchantMyCatalogCue({
  href,
  label,
  hint,
  metrics,
  actionLabel = "Open",
  variant = "supplier",
  surface = "light",
  className,
}: Props) {
  const isLight = surface === "light"
  const detail = metrics ?? hint

  const accentBorder =
    variant === "affiliate"
      ? isLight
        ? "border-emerald-200/80 hover:border-emerald-300/90"
        : "border-emerald-500/15 hover:border-emerald-400/30"
      : isLight
        ? "border-violet-200/80 hover:border-violet-300/90"
        : "border-violet-500/15 hover:border-violet-400/30"

  const accentBar =
    variant === "affiliate"
      ? "from-emerald-400/90 via-emerald-500/40 to-transparent"
      : "from-violet-400/90 via-violet-500/40 to-transparent"

  const accentGlow =
    variant === "affiliate"
      ? isLight
        ? "from-emerald-500/6 via-transparent to-transparent group-hover:from-emerald-500/10"
        : "from-emerald-500/8 via-transparent to-transparent group-hover:from-emerald-500/12"
      : isLight
        ? "from-violet-500/6 via-transparent to-transparent group-hover:from-violet-500/10"
        : "from-violet-500/8 via-transparent to-transparent group-hover:from-violet-500/12"

  return (
    <Link
      href={href}
      className={cn(
        "group relative inline-flex h-9 w-max max-w-full items-center gap-2 overflow-hidden rounded-full",
        "px-2.5 backdrop-blur-xl transition duration-200 active:scale-[0.98] sm:gap-2.5 sm:px-3",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70",
        isLight
          ? "border bg-violet-50/85 text-violet-950 shadow-sm shadow-violet-900/[0.04] hover:bg-violet-100/75"
          : "border border-violet-500/15 bg-violet-950/85 text-violet-100 shadow-[0_1px_0_0_rgba(139,92,246,0.08)] hover:bg-violet-950/95",
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
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/25 to-transparent"
        aria-hidden
      />

      <span
        className={cn(
          "relative flex size-6 shrink-0 items-center justify-center rounded-full border transition duration-200",
          isLight
            ? "border-violet-200/70 bg-violet-100/60 group-hover:border-violet-300 group-hover:bg-violet-100/80"
            : "border-violet-400/15 bg-violet-500/[0.08] group-hover:border-violet-400/25 group-hover:bg-violet-500/[0.12]"
        )}
      >
        <Package
          className={cn("size-3", isLight ? "text-violet-600" : "text-violet-300")}
          aria-hidden
        />
      </span>

      <span className="relative flex min-w-0 items-center gap-1.5 sm:gap-2">
        <span
          className={cn(
            "whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em]",
            isLight ? "text-violet-900" : "text-violet-100"
          )}
        >
          {label}
        </span>
        {detail ? (
          <>
            <span
              className={cn("hidden shrink-0 sm:inline", isLight ? "text-violet-300" : "text-violet-600")}
              aria-hidden
            >
              ·
            </span>
            <span
              className={cn(
                "hidden max-w-[14rem] truncate text-[10px] font-medium normal-case tracking-normal sm:inline",
                isLight ? "text-violet-800/70" : "text-violet-300/70"
              )}
            >
              {detail}
            </span>
          </>
        ) : null}
      </span>

      <span
        className={cn(
          "relative hidden shrink-0 items-center gap-0.5 pl-0.5 sm:inline-flex",
          "text-[10px] font-semibold uppercase tracking-[0.14em] transition duration-200",
          isLight ? "text-violet-600/70 group-hover:text-violet-800" : "text-violet-400/70 group-hover:text-violet-200"
        )}
      >
        {actionLabel}
        <ChevronRight
          className="size-3 transition duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>

      <ChevronRight
        className={cn(
          "relative size-3 shrink-0 transition duration-200 group-hover:translate-x-0.5 sm:hidden",
          isLight ? "text-violet-600/70 group-hover:text-violet-800" : "text-violet-400/70 group-hover:text-violet-200"
        )}
        aria-hidden
      />
    </Link>
  )
}
