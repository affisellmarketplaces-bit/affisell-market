"use client"

import Link from "next/link"
import { Brain, Heart, Radar, Store } from "lucide-react"

import { cn } from "@/lib/utils"

const BUYER_PULSE = [
  {
    href: "/agent",
    label: "Agent shopping",
    hint: "Conseiller IA pour trouver le bon produit",
    Icon: Brain,
    className: "from-violet-600 to-indigo-600 text-white shadow-violet-500/25",
  },
  {
    href: "/shops",
    label: "Boutiques créateurs",
    hint: "Parcourir les vitrines",
    Icon: Store,
    className: "from-fuchsia-600 to-pink-600 text-white shadow-fuchsia-500/25",
  },
  {
    href: "/?q=smart",
    label: "Recherche intelligente",
    hint: "Essai démo « smart »",
    Icon: Radar,
    className: "from-sky-600 to-cyan-600 text-white shadow-sky-500/25",
  },
  {
    href: "/wishlist",
    label: "Favoris",
    hint: "Alertes prix & wishlist",
    Icon: Heart,
    className: "from-amber-600 to-orange-600 text-white shadow-amber-500/25",
  },
] as const

const DEFAULT_PULSE = [
  {
    href: "/agent",
    label: "Agent Affisell",
    hint: "Conseiller shopping IA",
    Icon: Brain,
    className: "from-violet-600 to-indigo-600 text-white shadow-violet-500/25",
  },
  {
    href: "/discover",
    label: "Discover",
    hint: "Tendances & nouveautés",
    Icon: Radar,
    className: "from-fuchsia-600 to-pink-600 text-white shadow-fuchsia-500/25",
  },
  {
    href: "/shops/browse?q=smart",
    label: "Recherche vivante",
    hint: "Filtre démo « smart »",
    Icon: Radar,
    className: "from-sky-600 to-cyan-600 text-white shadow-sky-500/25",
  },
  {
    href: "/wishlist",
    label: "Wishlist",
    hint: "Alertes prix & favoris",
    Icon: Heart,
    className: "from-amber-600 to-orange-600 text-white shadow-amber-500/25",
  },
] as const

type Props = {
  audience?: "buyer" | "default"
}

export function MarketplaceAffisellPulse({ audience = "default" }: Props) {
  const pulse = audience === "buyer" ? BUYER_PULSE : DEFAULT_PULSE

  return (
    <section
      className="mt-4 rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50/95 via-white to-violet-50/40 p-4 shadow-sm dark:border-zinc-800 dark:from-zinc-900/50 dark:via-zinc-950 dark:to-violet-950/20"
      aria-label="Services Affisell"
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {audience === "buyer" ? "Acheter malin sur Affisell" : "Plus qu’un marketplace — couche Affisell"}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {pulse.map(({ href, label, hint, Icon, className }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex min-h-[4.25rem] flex-col justify-center gap-0.5 rounded-xl bg-gradient-to-br px-3 py-2.5 text-sm font-semibold shadow-md transition hover:opacity-95 active:scale-[0.99]",
                className
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 opacity-95" aria-hidden />
                {label}
              </span>
              <span className="text-[11px] font-normal opacity-90">{hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
