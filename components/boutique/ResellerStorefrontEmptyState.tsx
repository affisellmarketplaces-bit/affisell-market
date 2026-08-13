"use client"

import Link from "next/link"
import { Sparkles, Store } from "lucide-react"
import { toast } from "sonner"

import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"

type Props = {
  storeSlug: string
  storeLabel: string
  theme: ResellerBoutiqueThemeProps
}

export function ResellerStorefrontEmptyState({ storeSlug, storeLabel, theme: _theme }: Props) {
  const handleAiPersonalize = () => {
    toast.message("AI Personalization coming soon — will call /api/ai/store-avatar")
  }

  return (
    <>
      <header className="relative mb-10">
        <button
          type="button"
          onClick={handleAiPersonalize}
          className="mb-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-black px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(109,40,217,0.3)] transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:text-black hover:shadow-[0_0_30px_rgba(109,40,217,0.5)] md:absolute md:right-0 md:top-0 md:mb-0 md:w-auto"
        >
          <Sparkles className="size-4 shrink-0" aria-hidden />
          Personalize my store with AI ✨
        </button>

        <h1 className="text-balance pr-0 text-3xl font-bold tracking-tight sm:text-4xl md:pr-[17rem]">
          Boutique{" "}
          <span className="bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
            {storeLabel}
          </span>
        </h1>
      </header>

      <section className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center">
        <div className="w-full rounded-3xl border border-white/50 bg-white/[0.95] p-10 text-center shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-teal-500 text-white shadow-lg">
            <Store className="size-8" aria-hidden />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-gray-900">Boutique vide</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">
            Ajoute des produits depuis ton dashboard affiliate pour lancer ta vitrine reseller.
          </p>
          <Link
            href="/dashboard/affiliate"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-teal-500 px-6 text-sm font-medium text-white transition-all duration-300 hover:from-violet-700 hover:to-teal-600 hover:shadow-[0_4px_20px_rgba(109,40,217,0.4)]"
          >
            Ajouter des produits
          </Link>
          <p className="mt-4 font-mono text-[11px] text-gray-400">/boutique/{storeSlug}</p>
        </div>
      </section>
    </>
  )
}
