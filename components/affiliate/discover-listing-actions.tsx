"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Loader2, Pencil, Rocket, Sparkles, Undo2, Zap } from "lucide-react"
import { useLocale } from "next-intl"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import type { CatalogListingState } from "@/lib/affiliate-catalog-listing-state"
import { resolveBinaryCopyLocale } from "@/lib/i18n-ui-locale"
import { cn } from "@/lib/utils"

type Props = {
  state: CatalogListingState
  locale?: "fr" | "en"
  releasing?: boolean
  onAdd: () => void
  onEdit: (listingId: string) => void
  onRelease: (listingId: string) => void | Promise<void>
  className?: string
}

const copy = {
  fr: {
    add: "Ajouter à ma vitrine",
    edit: "Modifier ma fiche",
    relist: "Remettre en vitrine",
    release: "Libérer du flux",
    releaseTitle: "Libérer ce SKU ?",
    releaseBody:
      "Le produit disparaît de votre boutique publique et redevient disponible dans Discover — vous pourrez le republier avec une nouvelle marge à tout moment.",
    releaseHint: "Les ventes passées restent dans votre historique.",
    cancel: "Garder en vitrine",
    confirm: "Libérer",
    hiddenBadge: "Hors vitrine — prêt à relister",
  },
  en: {
    add: "Add to my store",
    edit: "Edit listing",
    relist: "Add back to storefront",
    release: "Release from store",
    releaseTitle: "Release this SKU?",
    releaseBody:
      "It leaves your public shop and returns to Discover — you can publish again with fresh pricing anytime.",
    releaseHint: "Past orders stay in your history.",
    cancel: "Keep live",
    confirm: "Release",
    hiddenBadge: "Off storefront — ready to relist",
  },
} as const

export function DiscoverListingActions({
  state,
  locale: localeProp,
  releasing = false,
  onAdd,
  onEdit,
  onRelease,
  className,
}: Props) {
  const localeFromContext = useLocale()
  const locale = localeProp ?? resolveBinaryCopyLocale(localeFromContext)
  const t = copy[locale]
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const closeRelease = useCallback(() => {
    if (releasing) return
    setReleaseOpen(false)
    setPendingId(null)
  }, [releasing])

  const confirmRelease = useCallback(async () => {
    if (!pendingId || releasing) return
    await onRelease(pendingId)
    closeRelease()
  }, [closeRelease, onRelease, pendingId, releasing])

  return (
    <>
      <div className={cn("mt-3 space-y-2", className)}>
        {state.kind === "none" ? (
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onAdd}
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(124,58,237,0.35)] transition hover:brightness-105"
          >
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.18)_50%,transparent_60%)] opacity-0 transition group-hover:opacity-100" />
            <span className="relative inline-flex items-center justify-center gap-2">
              <Rocket className="size-4" aria-hidden />
              {t.add}
            </span>
          </motion.button>
        ) : null}

        {state.kind === "hidden" ? (
          <>
            <p className="flex items-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[11px] font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
              <Undo2 className="size-3.5 shrink-0" aria-hidden />
              {t.hiddenBadge}
            </p>
            <Button
              type="button"
              variant="bentoAccent"
              className="w-full"
              onClick={() => onEdit(state.listingId)}
            >
              <Sparkles className="size-4" aria-hidden />
              {t.relist}
            </Button>
          </>
        ) : null}

        {state.kind === "live" ? (
          <>
            <Button
              type="button"
              variant="bentoAccent"
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
              onClick={() => onEdit(state.listingId)}
            >
              <Pencil className="size-4" aria-hidden />
              {t.edit}
            </Button>
            <button
              type="button"
              disabled={releasing}
              onClick={() => {
                setPendingId(state.listingId)
                setReleaseOpen(true)
              }}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200/90 bg-white/80 px-3 py-2.5 text-sm font-medium text-zinc-600 shadow-sm transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:border-violet-700 dark:hover:text-violet-300"
            >
              {releasing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Zap className="size-4 text-violet-500 transition group-hover:rotate-12" aria-hidden />
              )}
              {t.release}
            </button>
          </>
        ) : null}
      </div>

      <AnimatePresence>
        {releaseOpen && pendingId ? (
          <motion.div
            key="release-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end justify-center bg-zinc-950/60 p-4 backdrop-blur-md sm:items-center"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeRelease()
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 text-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="release-listing-title"
            >
              <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-violet-600/30 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-fuchsia-600/25 blur-3xl" />
              <div className="relative p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                  Discover · flux
                </p>
                <h2 id="release-listing-title" className="mt-2 text-xl font-bold tracking-tight">
                  {t.releaseTitle}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{t.releaseBody}</p>
                <p className="mt-2 text-xs text-zinc-500">{t.releaseHint}</p>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={releasing}
                    onClick={closeRelease}
                    className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={releasing}
                    onClick={() => void confirmRelease()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 disabled:opacity-50"
                  >
                    {releasing ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
                    {t.confirm}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
