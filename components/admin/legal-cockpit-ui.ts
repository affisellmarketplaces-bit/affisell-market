/** Shared dark cockpit chrome for Avocat Numérique admin — WCAG-friendly on zinc-950. */
export const LEGAL_COCKPIT_SHELL =
  "min-h-[calc(100dvh-3.75rem)] bg-zinc-950 text-zinc-100"

export const LEGAL_COCKPIT_CARD =
  "!rounded-2xl border border-zinc-800/90 bg-zinc-900 !p-5 shadow-2xl shadow-black/50 ring-1 ring-white/[0.07] backdrop-blur-xl md:!p-6"

export const LEGAL_COCKPIT_CARD_ACCENT =
  "border-amber-500/25 bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/20"

export const LEGAL_COCKPIT_HEADING =
  "[&_h1]:text-white [&_h1]:drop-shadow-sm [&_p.text-xs]:text-amber-400/90 [&_div.text-base]:text-zinc-300"

export const LEGAL_COCKPIT_TAB_IDLE =
  "border-zinc-600 bg-zinc-900/80 text-zinc-200 hover:border-amber-500/40 hover:bg-zinc-800 hover:text-white"

export const LEGAL_COCKPIT_TAB_ACTIVE = "bg-amber-600 text-white shadow-lg shadow-amber-950/50 hover:bg-amber-500"

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
  if (status === "open") return "bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/50"
  if (status === "fixed") return "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/50"
  if (status === "ignored") return "bg-zinc-600/40 text-zinc-200 ring-1 ring-zinc-500/50"
  return "bg-zinc-700/50 text-zinc-200 ring-1 ring-zinc-600/50"
}

export function legalDocStatusBadge(status: string): string {
  if (status === "draft") return "bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/50"
  if (status === "published") return "bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/50"
  if (status === "signed") return "bg-violet-500/25 text-violet-100 ring-1 ring-violet-400/50"
  if (status === "archived") return "bg-zinc-600/40 text-zinc-300 ring-1 ring-zinc-500/50"
  return "bg-zinc-700/50 text-zinc-200 ring-1 ring-zinc-600/50"
}

export function legalOutlineButtonClass(extra?: string): string {
  return `border-zinc-600 bg-zinc-900/80 text-zinc-100 hover:border-amber-500/50 hover:bg-zinc-800 hover:text-white ${extra ?? ""}`
}
