/**
 * Affisell Orbital — Avocat Numérique cockpit tokens.
 * Violet/indigo brand band (admin nav, hero, orbital system).
 */
import { brandOrbitPillActive } from "@/lib/affisell-brand-orbit-shared"

export const LEGAL_COCKPIT_SHELL =
  "min-h-[calc(100dvh-3.75rem)] bg-zinc-950 text-zinc-100"

export const LEGAL_COCKPIT_CARD =
  "!rounded-2xl border border-zinc-800/90 bg-zinc-900 !p-5 shadow-2xl shadow-black/50 ring-1 ring-white/[0.07] backdrop-blur-xl md:!p-6"

export const LEGAL_COCKPIT_CARD_ACCENT =
  "border-violet-500/25 bg-gradient-to-br from-zinc-900 via-zinc-900 to-violet-950/25"

export const LEGAL_COCKPIT_CARD_HOVER = "transition hover:border-violet-500/40"

export const LEGAL_COCKPIT_HEADING =
  "[&_h1]:text-white [&_h1]:drop-shadow-sm [&_p.text-xs]:text-violet-400/90 [&_div.text-base]:text-zinc-300"

export const LEGAL_COCKPIT_TAB_IDLE =
  "border-zinc-600 bg-zinc-900/80 text-zinc-200 hover:border-violet-500/40 hover:bg-zinc-800 hover:text-white"

export const LEGAL_COCKPIT_TAB_ACTIVE = `${brandOrbitPillActive} shadow-lg shadow-violet-950/50`

export const LEGAL_COCKPIT_ATMOSPHERE =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(109,40,217,0.2),transparent_55%),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(67,56,202,0.14),transparent)]"

export const LEGAL_COCKPIT_ATMOSPHERE_COMPACT =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(109,40,217,0.22),transparent)]"

export const LEGAL_COCKPIT_ICON = "text-violet-400"
export const LEGAL_COCKPIT_EYEBROW =
  "text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400/90"
export const LEGAL_COCKPIT_ACCENT_TEXT = "text-violet-200"
export const LEGAL_COCKPIT_ACCENT_TEXT_SOFT = "text-violet-100/90"
export const LEGAL_COCKPIT_ACCENT_LABEL = "text-xs font-bold uppercase text-violet-300"

export const LEGAL_COCKPIT_CTA =
  "gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 shadow-md shadow-violet-950/40 hover:from-violet-500 hover:to-indigo-500"

export const LEGAL_COCKPIT_CTA_SOLID = "bg-violet-700 hover:bg-violet-600"

export const LEGAL_COCKPIT_CTA_SECONDARY =
  "gap-1.5 bg-gradient-to-r from-zinc-700 to-violet-800 hover:from-zinc-600 hover:to-violet-700"

export const LEGAL_COCKPIT_MODAL_SHELL =
  "border-violet-500/25 bg-zinc-950 shadow-2xl shadow-violet-950/20"

export const LEGAL_COCKPIT_MODAL_HEADER =
  "border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-violet-950/35"

export const LEGAL_COCKPIT_CALLOUT =
  "flex items-start gap-2 rounded-xl border border-violet-500/25 bg-violet-950/25 px-3 py-2.5"

export const LEGAL_COCKPIT_INPUT =
  "rounded-xl border border-zinc-700/80 bg-black/50 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"

export const LEGAL_COCKPIT_INPUT_SM =
  "rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"

export const LEGAL_COCKPIT_STATUS_BADGE =
  "flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-950/60 px-3 py-1.5 text-xs font-semibold text-violet-50 shadow-lg shadow-violet-950/40 backdrop-blur-md"

export const LEGAL_COCKPIT_PULSE_RING = "ring-2 ring-violet-400/30"
export const LEGAL_COCKPIT_PULSE_DOT = "bg-violet-400"

export const LEGAL_COCKPIT_STAT_ICON =
  "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-800 shadow-lg shadow-violet-950/50"

export const LEGAL_COCKPIT_STAT_ICON_INNER = "size-5 text-violet-50"

export const LEGAL_COCKPIT_STAT_VALUE =
  "font-mono text-2xl font-bold tabular-nums text-violet-300"

export const LEGAL_COCKPIT_CODE_BLOCK =
  "overflow-auto whitespace-pre-wrap rounded-xl border border-violet-500/30 bg-zinc-950/90 p-4 font-mono text-xs leading-relaxed text-violet-100/95"

export const LEGAL_COCKPIT_ACTION_WARN =
  "h-8 gap-1 border-violet-500/50 bg-violet-950/40 px-2.5 text-[11px] font-medium text-violet-100 hover:bg-violet-900/60"

export const LEGAL_COCKPIT_PREVIEW_TAB_ACTIVE =
  "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-950/40"

export const LEGAL_COCKPIT_TABLE_WRAP = "overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-950/60"

export const LEGAL_COCKPIT_TABLE_HEAD =
  "border-b border-zinc-700 bg-zinc-900 text-[11px] font-semibold uppercase tracking-wider text-zinc-300"

export const LEGAL_COCKPIT_TABLE_ROW =
  "border-b border-zinc-800/90 transition-colors hover:bg-zinc-800/50 even:bg-zinc-900/40"

export const LEGAL_COCKPIT_TEXT_PRIMARY = "text-zinc-100"
export const LEGAL_COCKPIT_TEXT_SECONDARY = "text-zinc-300"
export const LEGAL_COCKPIT_TEXT_MUTED = "text-zinc-400"
export const LEGAL_COCKPIT_TEXT_SUBTLE = "text-zinc-500"

export function legalScanStatusBadge(status: string): string {
  if (status === "open") return "bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/50"
  if (status === "fixed") return "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/50"
  if (status === "ignored") return "bg-zinc-600/40 text-zinc-200 ring-1 ring-zinc-500/50"
  return "bg-zinc-700/50 text-zinc-200 ring-1 ring-zinc-600/50"
}

export function legalDocStatusBadge(status: string): string {
  if (status === "draft") return "bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/50"
  if (status === "published") return "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/50"
  if (status === "signed") return "bg-indigo-500/25 text-indigo-100 ring-1 ring-indigo-400/50"
  if (status === "archived") return "bg-zinc-600/40 text-zinc-300 ring-1 ring-zinc-500/50"
  return "bg-zinc-700/50 text-zinc-200 ring-1 ring-zinc-600/50"
}

export function legalOutlineButtonClass(extra?: string): string {
  return `border-zinc-600 bg-zinc-900/80 text-zinc-100 hover:border-violet-500/50 hover:bg-zinc-800 hover:text-white ${extra ?? ""}`
}
