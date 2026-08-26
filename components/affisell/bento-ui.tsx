import type { ComponentProps, ReactNode } from "react"

import { affisellBrand } from "@/lib/affisell-brand"
import { cn } from "@/lib/utils"

/** Page chrome under the site header — use inside routes; root `body` already has the pastel gradient. */
export function BentoShell({
  children,
  className,
  tone = "auto",
}: {
  children: ReactNode
  className?: string
  /** Explicit contrast when shell bg ignores system color scheme (admin cockpits). */
  tone?: "light" | "dark" | "auto"
}) {
  return (
    <div
      className={cn(
        "min-h-[calc(100dvh-3.75rem)]",
        tone === "dark" && "text-zinc-100",
        tone === "light" && "text-gray-900",
        tone === "auto" && "text-gray-900 dark:text-zinc-50",
        className
      )}
    >
      {children}
    </div>
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
export function BentoCard({
  className,
  children,
  variant = "default",
  ...rest
}: ComponentProps<"div"> & {
  /** Dark admin cockpit — skips light epoxy surface. */
  variant?: "default" | "dark"
}) {
  return (
    <div
      className={cn(
        variant === "dark"
          ? "rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-6 shadow-xl shadow-black/40 ring-1 ring-white/[0.08] backdrop-blur-xl md:p-8"
          : cn(affisellBrand.epoxySurfaceLight, "rounded-3xl p-6 md:p-8"),
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
  tone = "auto",
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  className?: string
  tone?: "light" | "dark" | "auto"
}) {
  const eyebrowClass =
    tone === "dark"
      ? "text-violet-300"
      : tone === "light"
        ? "text-gray-500"
        : "text-gray-500 dark:text-violet-300"
  const titleClass =
    tone === "dark"
      ? "text-white drop-shadow-sm"
      : tone === "light"
        ? "text-gray-900"
        : "text-gray-900 dark:text-white"
  const descriptionClass =
    tone === "dark"
      ? "text-zinc-300"
      : tone === "light"
        ? "text-gray-600"
        : "text-gray-600 dark:text-zinc-300"

  return (
    <div className={cn("space-y-3", className)}>
      {eyebrow ? (
        <p className={cn("text-xs font-semibold uppercase tracking-wider", eyebrowClass)}>{eyebrow}</p>
      ) : null}
      <h1
        className={cn(
          "text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl",
          titleClass
        )}
      >
        {title}
      </h1>
      {description ? (
        <div className={cn("max-w-2xl text-base leading-relaxed", descriptionClass)}>{description}</div>
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
