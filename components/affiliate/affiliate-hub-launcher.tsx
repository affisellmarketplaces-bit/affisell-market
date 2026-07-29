"use client"

import Link from "next/link"
import { ArrowLeft, Layers, Swords, Zap } from "lucide-react"
import { motion } from "framer-motion"

import { affisellBrand } from "@/lib/affisell-brand"
import {
  AFFILIATE_CATALOG_PATH,
  AFFILIATE_HUB_BATTLE_HREF,
  AFFILIATE_HUB_SWIPE_HREF,
} from "@/lib/affiliate-routes"
import { cn } from "@/lib/utils"

/**
 * Default hub landing — keeps Pulse Battle and Swipe Feed as separate products.
 */
export function AffiliateHubLauncher() {
  return (
    <div className={cn(affisellBrand.epoxyPage, "relative min-h-[calc(100dvh-3.75rem)] overflow-hidden")}>
      <div className={affisellBrand.epoxyCanvas} aria-hidden />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-violet-600/30 blur-[100px]" />
        <div className="absolute -right-20 bottom-32 h-80 w-80 rounded-full bg-amber-500/20 blur-[100px]" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-[90px]" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 py-10 md:px-8 md:py-16">
        <Link
          href={AFFILIATE_CATALOG_PATH}
          className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Catalogue classique
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-200 ring-1 ring-white/15">
            <Zap className="size-3.5" aria-hidden />
            Hub affilié
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
            Deux outils, zéro mélange
          </h1>
          <p className="mt-4 max-w-lg text-lg text-zinc-400">
            Swipe ajoute des produits à ta vitrine. Battle oppose deux fiches déjà listées pour
            un flash discount.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href={AFFILIATE_HUB_BATTLE_HREF}
            className={cn(
              affisellBrand.epoxySurface,
              "group relative overflow-hidden rounded-3xl p-6 transition-transform hover:scale-[1.02] active:scale-[0.99]"
            )}
            data-testid="hub-launch-battle"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(251,191,36,0.2),transparent_55%)]" />
            <div className="relative">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30">
                <Swords className="size-5" aria-hidden />
              </span>
              <p className="mt-4 text-sm font-medium text-amber-200/90">Pulse Battle</p>
              <p className="mt-1 text-xl font-bold text-white">Lancer un duel</p>
              <p className="mt-2 text-sm text-zinc-300/85">
                2 produits vitrine · votes · flash checkout
              </p>
            </div>
          </Link>

          <Link
            href={AFFILIATE_HUB_SWIPE_HREF}
            className={cn(
              affisellBrand.epoxySurface,
              "group relative overflow-hidden rounded-3xl p-6 transition-transform hover:scale-[1.02] active:scale-[0.99]"
            )}
            data-testid="hub-launch-swipe"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(192,38,211,0.25),transparent_55%)]" />
            <div className="relative">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30">
                <Layers className="size-5" aria-hidden />
              </span>
              <p className="mt-4 text-sm font-medium text-violet-200/90">Swipe Feed</p>
              <p className="mt-1 text-xl font-bold text-white">Ajouter en vitrine</p>
              <p className="mt-2 text-sm text-zinc-300/85">
                Swipe → studio marge · SEO · publication
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
