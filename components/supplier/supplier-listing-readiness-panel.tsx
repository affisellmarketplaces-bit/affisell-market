"use client"

import { CheckCircle2, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

export type ListingReadinessChecks = {
  title: boolean
  category: boolean
  specs: boolean
  images: boolean
  price?: boolean
}

type Props = {
  step: 1 | 2
  checks: ListingReadinessChecks
  productLabel?: string
  categoryLabel?: string | null
  priceLabel?: string | null
  className?: string
}

export function SupplierListingReadinessPanel({
  step,
  checks,
  productLabel,
  categoryLabel,
  priceLabel,
  className,
}: Props) {
  const step1Items = [
    ["Titre", checks.title],
    ["Catégorie", checks.category],
    ["Specs obligatoires", checks.specs],
    ["Photos", checks.images],
  ] as const

  const step1Complete = checks.title && checks.category && checks.specs && checks.images
  const step2Complete =
    step === 2 && checks.price !== undefined ? step1Complete && checks.price : step1Complete

  return (
    <div
      className={cn(
        "rounded-3xl border border-gray-100 bg-white/80 p-5 shadow-sm ring-1 ring-black/[0.02] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/75 dark:ring-white/[0.04]",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {step === 1 ? "Qualité de la fiche" : "Récapitulatif"}
      </p>
      {step === 1 ? (
        <>
          <ul className="mt-4 space-y-3 text-sm">
            {step1Items.map(([label, ok]) => (
              <li key={label} className="flex items-center gap-2">
                {ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-zinc-300 dark:text-zinc-600" aria-hidden />
                )}
                <span className={ok ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500"}>{label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p
              className={cn(
                "text-xs font-medium",
                step1Complete ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              {step1Complete
                ? "Étape 1 prête — passez au prix et à la publication."
                : "Complétez la catégorie pour débloquer les bons champs specs."}
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {productLabel?.trim() || "Sans titre"}
          </p>
          {categoryLabel ? (
            <p className="mt-2 line-clamp-3 text-xs text-zinc-500 dark:text-zinc-400">{categoryLabel}</p>
          ) : null}
          {priceLabel ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
              Prix de base :{" "}
              <span className="font-semibold text-zinc-900 dark:text-white">{priceLabel}</span>
            </p>
          ) : null}
          {checks.price !== undefined ? (
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              {step2Complete ? "Prêt à publier." : "Indiquez un prix valide pour continuer."}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
