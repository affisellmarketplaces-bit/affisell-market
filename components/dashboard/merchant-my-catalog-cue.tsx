import Link from "next/link"
import { ChevronRight, Package } from "lucide-react"

import { affisellBrand } from "@/lib/affisell-brand"
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
          ? cn(affisellBrand.epoxyChip, "border text-foreground shadow-sm hover:border-brand/25")
          : cn(affisellBrand.epoxyChip, "border border-brand-light/15 text-foreground hover:border-brand-light/25"),
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
            ? "border-border/70 bg-brand-muted/40 group-hover:border-brand/25 group-hover:bg-brand-muted/55"
            : "border-brand-light/15 bg-brand-muted/20 group-hover:border-brand-light/25 group-hover:bg-brand-muted/30"
        )}
      >
        <Package
          className={cn("size-3", isLight ? "text-brand" : "text-brand-light")}
          aria-hidden
        />
      </span>

      <span className="relative flex min-w-0 items-center gap-1.5 sm:gap-2">
        <span
          className={cn(
            "whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em]",
            isLight ? "text-foreground" : "text-foreground"
          )}
        >
          {label}
        </span>
        {detail ? (
          <>
            <span
              className={cn("hidden shrink-0 sm:inline text-muted-foreground/50", isLight ? "" : "")}
              aria-hidden
            >
              ·
            </span>
            <span
              className={cn(
                "hidden max-w-[14rem] truncate text-[10px] font-medium normal-case tracking-normal text-muted-foreground sm:inline"
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
          "text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition duration-200 group-hover:text-brand dark:group-hover:text-brand-light"
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
          "text-muted-foreground transition duration-200 group-hover:text-brand dark:group-hover:text-brand-light"
        )}
        aria-hidden
      />
    </Link>
  )
}
