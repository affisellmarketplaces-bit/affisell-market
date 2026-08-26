/**
 * Affisell Orbital — admin cockpit tokens (WCAG AA on forced-dark shells).
 * Use with BentoShell `tone="dark"` or `ADMIN_COCKPIT_SHELL` (`dark` class).
 */
import { brandOrbitPillActive } from "@/lib/affisell-brand-orbit-shared"

/** Forces Tailwind `dark:` variants inside the subtree — required when bg is zinc-950 without system dark mode. */
export const ADMIN_COCKPIT_SHELL =
  "dark min-h-[calc(100dvh-3.75rem)] bg-zinc-950 text-zinc-100"

export const ADMIN_COCKPIT_ATMOSPHERE =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(109,40,217,0.16),transparent_55%),radial-gradient(ellipse_55%_45%_at_100%_80%,rgba(67,56,202,0.1),transparent)]"

export const ADMIN_COCKPIT_CARD =
  "!rounded-2xl border border-zinc-700/80 bg-zinc-900/95 !p-5 shadow-xl shadow-black/40 ring-1 ring-white/[0.08] backdrop-blur-xl md:!p-6"

export const ADMIN_COCKPIT_CARD_ACCENT =
  "border-violet-500/30 bg-gradient-to-br from-zinc-900 via-zinc-900 to-violet-950/30"

export const ADMIN_COCKPIT_HEADING =
  "[&_h1]:text-white [&_h1]:drop-shadow-sm [&_p.text-xs]:text-violet-300 [&_div.text-base]:text-zinc-300"

export const ADMIN_COCKPIT_EYEBROW =
  "text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300"

export const ADMIN_COCKPIT_KPI_VALUE =
  "font-mono text-3xl font-bold tabular-nums tracking-tight text-white"

export const ADMIN_COCKPIT_KPI_LABEL =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400"

export const ADMIN_COCKPIT_TEXT_PRIMARY = "text-zinc-50"
export const ADMIN_COCKPIT_TEXT_SECONDARY = "text-zinc-300"
export const ADMIN_COCKPIT_TEXT_MUTED = "text-zinc-400"

export const ADMIN_COCKPIT_TABLE_WRAP =
  "overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-950/50"

export const ADMIN_COCKPIT_TABLE_HEAD =
  "border-b border-zinc-700 bg-zinc-900/90 text-[11px] font-semibold uppercase tracking-wider text-zinc-300"

export const ADMIN_COCKPIT_TABLE_ROW =
  "border-b border-zinc-800/90 transition-colors hover:bg-zinc-800/60 even:bg-zinc-900/30"

export const ADMIN_COCKPIT_TAB_IDLE =
  "border-zinc-600 bg-zinc-900/90 text-zinc-100 hover:border-violet-500/45 hover:bg-zinc-800 hover:text-white"

export const ADMIN_COCKPIT_TAB_ACTIVE = `${brandOrbitPillActive} shadow-lg shadow-violet-950/40`

export const ADMIN_COCKPIT_LINK = "font-medium text-violet-300 hover:text-violet-200"

export function adminStatusBadgeOperational(): string {
  return "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/40"
}

export function adminStatusBadgeDegraded(): string {
  return "bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/40"
}

export function adminStatusBadgeDisabled(): string {
  return "bg-zinc-600/30 text-zinc-200 ring-1 ring-zinc-500/40"
}
