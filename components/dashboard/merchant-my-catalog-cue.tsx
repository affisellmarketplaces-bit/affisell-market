import Link from "next/link"
import { ChevronRight, Package } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  href: string
  label: string
  variant?: "supplier" | "affiliate"
  className?: string
}

export function MerchantMyCatalogCue({
  href,
  label,
  variant = "supplier",
  className,
}: Props) {
  const accentHover =
    variant === "affiliate"
      ? "hover:border-emerald-500/35 hover:bg-emerald-950/20 hover:text-emerald-50/95"
      : "hover:border-violet-500/35 hover:bg-violet-950/20 hover:text-violet-50/95"

  const iconGlow =
    variant === "affiliate"
      ? "group-hover:shadow-[0_0_14px_rgba(16,185,129,0.28)]"
      : "group-hover:shadow-[0_0_14px_rgba(124,58,237,0.28)]"

  return (
    <Link
      href={href}
      className={cn(
        "group mt-3 inline-flex max-w-full items-center gap-2.5 rounded-full",
        "border border-zinc-200/70 bg-zinc-950/[0.03] px-3 py-1.5 backdrop-blur-md",
        "dark:border-white/10 dark:bg-zinc-950/50",
        "text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.04)] transition duration-200",
        "hover:scale-[1.02] active:scale-[0.98]",
        accentHover,
        className
      )}
    >
      <span
        className={cn(
          "relative flex size-6 shrink-0 items-center justify-center rounded-full",
          "border border-white/10 bg-white/5 transition duration-200",
          iconGlow
        )}
      >
        <Package className="size-3.5 text-zinc-400 transition group-hover:text-zinc-200" aria-hidden />
      </span>
      <span className="truncate">{label}</span>
      <ChevronRight
        className="size-3.5 shrink-0 text-zinc-500/80 transition duration-200 group-hover:translate-x-0.5 group-hover:text-zinc-300"
        aria-hidden
      />
    </Link>
  )
}
