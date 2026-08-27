"use client"

import { useSearchParams } from "next/navigation"

import type { WizardV2Mode } from "@/lib/product-wizard-v2/feature-flag"
import { cn } from "@/lib/utils"
import { useSafeAppRouter } from "@/hooks/use-safe-app-router"

const MODES: { id: WizardV2Mode; label: string; hint: string; recommended?: boolean }[] = [
  { id: "pro", label: "Pro", hint: "Fiche complète · galerie · catégories Affisell", recommended: true },
  { id: "express", label: "Express", hint: "URL → preview → publish (~15 s)" },
]

type Props = {
  mode: WizardV2Mode
  ownerUserId: string
  shopifyDomain?: string | null
}

export function WizardV2Chrome({ mode, ownerUserId, shopifyDomain }: Props) {
  const { replace, mounted } = useSafeAppRouter()
  const searchParams = useSearchParams()

  function setMode(next: WizardV2Mode) {
    if (!mounted) return
    const qs = new URLSearchParams(searchParams.toString())
    qs.set("wizard", "v2")
    qs.set("mode", next)
    if (!qs.has("compose")) qs.set("compose", "1")
    replace(`/dashboard/supplier/products/new?${qs.toString()}`, { scroll: false })
  }

  return (
    <>
      <header className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-600">Wizard v2</p>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Publier en 1 clic</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {mode === "express"
            ? `Mode Express — import URL · utilisateur ${ownerUserId.slice(0, 8)}…`
            : "Mode Pro — fiche marketplace complète (recommandé)"}
        </p>
      </header>

      {shopifyDomain && mode === "express" ? (
        <div
          className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
        >
          Import depuis Shopify en ~10 s — boutique connectée : <strong>{shopifyDomain}</strong>
        </div>
      ) : null}

      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Mode wizard">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={cn(
              "rounded-xl border px-4 py-2 text-left text-sm transition",
              mode === m.id
                ? "border-violet-500 bg-violet-50 font-semibold dark:bg-violet-950/50"
                : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800"
            )}
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
          >
            <span className="flex items-center gap-2">
              <span>{m.label}</span>
              {m.recommended ? (
                <span className="rounded-full bg-violet-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
                  Recommandé
                </span>
              ) : null}
            </span>
            <span className="text-xs font-normal text-zinc-500">{m.hint}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
