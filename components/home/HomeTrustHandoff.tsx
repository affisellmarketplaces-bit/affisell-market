import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ShieldCheck, Sparkles } from "lucide-react"

const trustPillClass =
  "inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-sm backdrop-blur-md transition hover:border-violet-300/50 hover:text-violet-700 dark:border-zinc-700/80 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:text-violet-200"

/** Bande 03 — confiance acheteur (sans doublon tier 02). */
export async function HomeTrustHandoff() {
  const t = await getTranslations("home.trustHandoff")

  const trustLinks = [
    { href: "/returns", label: t("trustReturns") },
    { href: "/shipping", label: t("trustShipping") },
    { href: "/support", label: t("trustSupport") },
  ] as const

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-white to-violet-500/5 px-4 py-5 dark:from-emerald-950/30 dark:via-zinc-950/50 dark:to-violet-950/20 sm:px-6 sm:py-6"
      aria-label={t("trustTitle")}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-inner shadow-emerald-950/30">
            <ShieldCheck className="size-5 text-white" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("trustTitle")}</p>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("trustBody")}</p>
            <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-zinc-500">
              <Sparkles className="size-3 text-violet-500" aria-hidden />
              {t("trustFootnote")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {trustLinks.map(({ href, label }) => (
            <Link key={href} href={href} className={trustPillClass}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
