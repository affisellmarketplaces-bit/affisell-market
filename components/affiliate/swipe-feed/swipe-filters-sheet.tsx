"use client"

import { Filter, X } from "lucide-react"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"
import {
  AFFILIATE_CATALOG_NICHES,
  type AffiliateCatalogNiche,
} from "@/lib/affiliate-catalog-types"
import type { SwipeFeedFilters } from "@/lib/affiliate-swipe-feed-types"
import { cn } from "@/lib/utils"

const NICHE_OPTIONS = [
  { id: "" as const, label: "Tous" },
  { id: "fitness" as const, label: "Fitness" },
  { id: "tech" as const, label: "Tech" },
  { id: "maison" as const, label: "Maison" },
] as const

const COMMISSION_PRESETS = [0, 10, 15, 20, 25] as const

type Props = {
  open: boolean
  filters: SwipeFeedFilters
  onClose: () => void
  onApply: (filters: SwipeFeedFilters) => void
}

export function SwipeFiltersSheet({ open, filters, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<SwipeFeedFilters>(filters)

  useEffect(() => {
    if (open) setDraft(filters)
  }, [open, filters])

  const activeCount =
    (draft.niche ? 1 : 0) +
    (draft.minCommission && draft.minCommission > 0 ? 1 : 0) +
    (draft.q ? 1 : 0)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Fermer les filtres"
            className="fixed inset-0 z-40 bg-zinc-950/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="swipe-filters-title"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-3xl border border-white/10 bg-zinc-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="swipe-filters-title" className="flex items-center gap-2 text-lg font-semibold text-white">
                <Filter className="size-5 text-violet-400" aria-hidden />
                Filtres Swipe
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                aria-label="Fermer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Niche</p>
                <div className="flex flex-wrap gap-2">
                  {NICHE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id || "all"}
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          niche: opt.id || undefined,
                        }))
                      }
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                        (draft.niche ?? "") === opt.id
                          ? "bg-violet-600 text-white"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Commission minimum
                </p>
                <div className="flex flex-wrap gap-2">
                  {COMMISSION_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          minCommission: pct > 0 ? pct : undefined,
                        }))
                      }
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                        (draft.minCommission ?? 0) === pct
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      )}
                    >
                      {pct === 0 ? "Toutes" : `≥ ${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Recherche</p>
                <input
                  type="search"
                  value={draft.q ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      q: e.target.value.trim() || undefined,
                    }))
                  }
                  placeholder="Nom, catégorie, tag…"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800"
                onClick={() => {
                  setDraft({})
                  onApply({})
                  onClose()
                }}
              >
                Réinitialiser
              </Button>
              <Button
                type="button"
                className="flex-1 bg-violet-600 hover:bg-violet-500"
                onClick={() => {
                  onApply(draft)
                  onClose()
                }}
              >
                Appliquer{activeCount > 0 ? ` (${activeCount})` : ""}
              </Button>
            </div>

            {draft.niche && draft.niche in AFFILIATE_CATALOG_NICHES && (
              <p className="mt-3 text-center text-[11px] text-zinc-500">
                Niche « {draft.niche} » —{" "}
                {AFFILIATE_CATALOG_NICHES[draft.niche as AffiliateCatalogNiche].slice(0, 3).join(", ")}…
              </p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export function swipeFiltersActiveCount(filters: SwipeFeedFilters): number {
  return (
    (filters.niche ? 1 : 0) +
    (filters.minCommission && filters.minCommission > 0 ? 1 : 0) +
    (filters.q ? 1 : 0)
  )
}
