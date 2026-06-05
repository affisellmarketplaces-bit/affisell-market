"use client"

import { Gift, Package, Recycle, RefreshCw, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  DEFAULT_PRODUCT_OFFER_MODE,
  PRODUCT_OFFER_MODES,
  WHOLESALE_DEFAULT_MOQ,
  type ProductOfferMode,
} from "@/lib/product-offer-mode"
import { cn } from "@/lib/utils"

type ModeMeta = {
  id: ProductOfferMode
  icon: LucideIcon
  title: string
  hint: string
  gradient: string
}

const MODES: ModeMeta[] = [
  {
    id: "STANDARD",
    icon: Sparkles,
    title: "Neuf / standard",
    hint: "Produit classique marketplace",
    gradient: "from-zinc-500/10 to-zinc-500/5",
  },
  {
    id: "REFURBISHED",
    icon: Recycle,
    title: "Reconditionné",
    hint: "Remis à neuf, garanti & contrôlé",
    gradient: "from-teal-500/15 to-emerald-500/5",
  },
  {
    id: "SECOND_HAND",
    icon: RefreshCw,
    title: "Seconde main",
    hint: "Article d'occasion authentique",
    gradient: "from-amber-500/15 to-orange-500/5",
  },
  {
    id: "WHOLESALE_ONLY",
    icon: Package,
    title: "Vente en gros",
    hint: "MOQ — uniquement lots professionnels",
    gradient: "from-indigo-500/15 to-violet-500/5",
  },
  {
    id: "DONATION",
    icon: Gift,
    title: "À donner",
    hint: "Gratuit ou prix symbolique 0 €",
    gradient: "from-emerald-500/15 to-teal-500/5",
  },
]

type Props = {
  value: ProductOfferMode
  minOrderQuantity: number
  onChange: (mode: ProductOfferMode) => void
  onMoqChange: (moq: number) => void
}

export function SupplierOfferModePicker({ value, minOrderQuantity, onChange, onMoqChange }: Props) {
  const showMoq = value === "WHOLESALE_ONLY"

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((m) => {
          const active = value === m.id
          const Icon = m.icon
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-4 text-left transition",
                active
                  ? "border-violet-500/60 bg-violet-500/10 ring-2 ring-violet-500/30"
                  : "border-zinc-200 bg-white hover:border-violet-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-violet-800"
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
                  m.gradient
                )}
              />
              <div className="relative">
                <Icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-violet-600 dark:text-violet-300" : "text-zinc-500"
                  )}
                  aria-hidden
                />
                <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{m.title}</p>
                <p className="mt-1 text-xs leading-snug text-zinc-600 dark:text-zinc-400">{m.hint}</p>
              </div>
            </button>
          )
        })}
      </div>

      {showMoq ? (
        <label className="block max-w-xs rounded-2xl border border-indigo-200/80 bg-indigo-50/50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">
            Quantité minimum (MOQ)
          </span>
          <input
            type="number"
            min={2}
            max={9999}
            value={minOrderQuantity}
            onChange={(e) => onMoqChange(Math.max(2, Math.round(Number(e.target.value)) || WHOLESALE_DEFAULT_MOQ))}
            className="mt-2 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm dark:border-indigo-800 dark:bg-zinc-950"
          />
          <p className="mt-1.5 text-[11px] text-indigo-900/70 dark:text-indigo-200/70">
            Les acheteurs devront commander au moins {minOrderQuantity} unités.
          </p>
        </label>
      ) : null}

      {value === "DONATION" ? (
        <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
          Prix catalogue à 0 € accepté. L&apos;affilié peut lister gratuitement ; le checkout Stripe nécessite un contact
          vendeur pour les dons 100 % gratuits.
        </p>
      ) : null}

      {!PRODUCT_OFFER_MODES.includes(value) ? (
        <input type="hidden" value={DEFAULT_PRODUCT_OFFER_MODE} readOnly />
      ) : null}
    </div>
  )
}
