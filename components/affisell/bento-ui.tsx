import type { ComponentProps, ReactNode } from "react"

import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

/** Page chrome under the site header — use inside routes; root `body` already has the pastel gradient. */
export function BentoShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-h-[calc(100dvh-3.75rem)] text-gray-900 dark:text-zinc-50", className)}>{children}</div>
  )
}

export function BentoContainer({
  children,
  className,
  maxWidth = "6xl",
}: {
  children: ReactNode
  className?: string
  maxWidth?: "4xl" | "5xl" | "6xl" | "7xl"
}) {
  const mw =
    maxWidth === "7xl"
      ? "max-w-7xl"
      : maxWidth === "5xl"
        ? "max-w-5xl"
        : maxWidth === "4xl"
          ? "max-w-4xl"
          : "max-w-6xl"
  return <div className={cn("mx-auto w-full px-4 py-8 md:px-8 md:py-10", mw, className)}>{children}</div>
}

/** Card shell: glassy white, soft border, generous radius (Bento / Modern SaaS). */
export function BentoCard({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        affisellBrand.epoxySurfaceLight,
        "rounded-3xl p-6 md:p-8",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function BentoPageHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-300">{eyebrow}</p>
      ) : null}
      <h1 className="text-balance text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">
        {title}
      </h1>
      {description ? (
        <div className="max-w-2xl text-base leading-relaxed text-gray-600 dark:text-zinc-300">{description}</div>
      ) : null}
    </div>
  )
}

/** KPI / stat tile inside a bento card or grid. */
export function BentoStat({
  label,
  value,
  hint,
  valueClassName,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  valueClassName?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-gray-100 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/50 md:p-6",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-300">{label}</p>
      <p className={cn("mt-2 text-3xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white", valueClassName)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-sm text-gray-600 dark:text-zinc-300">{hint}</p> : null}
    </div>
  )
}

export const bentoGrid = "grid gap-6 md:grid-cols-2 xl:grid-cols-12"
