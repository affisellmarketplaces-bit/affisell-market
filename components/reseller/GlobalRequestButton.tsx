"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"

const NEW_REQUEST_HREF = "/dashboard/reseller/requests/new"

type Variant = "primary" | "fab" | "header"

type Props = {
  variant?: Variant
  className?: string
  /** Optional prefill query string, e.g. title=...&q=... */
  href?: string
  label?: string
}

/**
 * Global entry points for reseller product requests — additive, zero break.
 */
export function GlobalRequestButton({
  variant = "primary",
  className,
  href = NEW_REQUEST_HREF,
  label,
}: Props) {
  if (variant === "fab") {
    return (
      <Link
        href={href}
        aria-label={label ?? "Demander un produit"}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full",
          "bg-orange-500 text-white shadow-lg shadow-orange-900/30",
          "transition hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500",
          "md:hidden",
          className
        )}
      >
        <Plus className="size-7" strokeWidth={2.5} aria-hidden />
      </Link>
    )
  }

  if (variant === "header") {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1.5",
          "text-xs font-semibold text-orange-800 transition hover:bg-orange-100",
          "dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-200",
          className
        )}
        title="Demander un produit"
      >
        <Plus className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">{label ?? "Demander"}</span>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2.5",
        "text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600",
        className
      )}
    >
      <Plus className="size-4 shrink-0" aria-hidden />
      {label ?? "+ Demander un produit introuvable"}
    </Link>
  )
}

export function ResellerRequestCtaBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-red-50 p-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div>
        <h3 className="text-base font-bold text-orange-950">
          Tu ne trouves pas un produit?
        </h3>
        <p className="mt-0.5 text-sm text-zinc-600">
          Décris-le, nos fournisseurs te répondent en &lt; 2h
        </p>
      </div>
      <GlobalRequestButton
        variant="primary"
        label="+ Demander un produit"
        className="shrink-0 px-6"
      />
    </div>
  )
}

export { NEW_REQUEST_HREF as RESELLER_NEW_REQUEST_PATH }
