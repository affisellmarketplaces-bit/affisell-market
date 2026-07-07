/** Footer — aligné sur BuyerHeroBlock + HomeBuyerSmartStrip (glass tiles). */

import {
  brandOrbitFooterShell,
  brandOrbitGridOverlay,
} from "@/lib/affisell-brand-orbit-shared"

export const footerHeroShell = brandOrbitFooterShell

export const footerHeroGrid = brandOrbitGridOverlay

export const footerHeroCard =
  "relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] backdrop-blur-xl transition duration-300 hover:border-white/20 hover:bg-white/10 hover:shadow-lg hover:shadow-violet-950/25"

export const footerHeroCardTile =
  "group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-violet-950/20 backdrop-blur-lg transition duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 hover:shadow-xl hover:shadow-violet-950/30"

export const footerHeroTitle =
  "text-xs font-bold uppercase tracking-wider text-white"

export const footerHeroLink =
  "inline-block text-sm text-zinc-300 transition-all hover:translate-x-1 hover:text-white"

export const footerHeroPillBtn =
  "inline-flex shrink-0 items-center rounded-full bg-[linear-gradient(135deg,#8B5CF6,#7C3AED)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_10px_24px_-12px_rgba(139,92,246,0.75)] transition-all hover:brightness-110 hover:shadow-xl active:scale-[0.99]"

export const footerLiveBadge =
  "affisell-live-badge rounded-full border border-white/30 bg-[#EF4444] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm shadow-red-950/30"

export const footerStripeBadge =
  "inline-flex shrink-0 items-center rounded-lg border border-[#8B5CF6]/50 bg-white/5 px-3 py-1.5 text-sm font-bold tracking-tight text-[#C4B5FD] backdrop-blur-lg"

export const footerHeroTagline = "text-sm leading-relaxed text-violet-100/85"

export const footerHeroGlow =
  "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-violet-400/90 to-indigo-500/90 opacity-40 blur-2xl transition group-hover:opacity-60"
