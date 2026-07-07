import { ArrowRight, Package, Store, Users } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { FastLink } from "@/components/navigation/fast-link"

const PATHS = [
  { key: "supplier" as const, href: "/partners", icon: Package, accent: "from-sky-500/15 to-cyan-500/10" },
  { key: "seller" as const, href: "/sellers", icon: Store, accent: "from-violet-500/15 to-fuchsia-500/10" },
  { key: "creator" as const, href: "/creators", icon: Users, accent: "from-amber-500/15 to-orange-500/10" },
]

/** Home — three business entry paths (supplier / seller / creator). */
export async function HomeEcosystemPathsStrip() {
  const t = await getTranslations("home.ecosystemPaths")

  return (
    <section
      className="mx-auto mt-4 w-full min-w-0 max-w-4xl text-left sm:mt-8"
      aria-label={t("title")}
    >
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/90 sm:text-xs">
        {t("eyebrow")}
      </p>
      <h2 className="mt-1 text-center text-sm font-bold text-white sm:text-lg">{t("title")}</h2>
      <ul className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
        {PATHS.map(({ key, href, icon: Icon, accent }) => (
          <li key={key}>
            <FastLink
              href={href}
              localeAware={href === "/creators" || href === "/partners" || href === "/sellers"}
              className={`group flex h-full flex-col rounded-2xl border border-white/15 bg-gradient-to-br ${accent} p-3 backdrop-blur-sm transition hover:border-white/30 hover:bg-white/10 sm:p-4`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-violet-100/70 transition group-hover:translate-x-0.5 group-hover:text-white"
                  aria-hidden
                />
              </div>
              <p className="mt-2 text-sm font-bold text-white">{t(`${key}.title`)}</p>
              <p className="mt-1 text-[11px] leading-snug text-violet-100/85 sm:text-xs">{t(`${key}.hint`)}</p>
              <span className="mt-2 text-[11px] font-semibold text-violet-100 group-hover:text-white sm:text-xs">
                {t(`${key}.cta`)}
              </span>
            </FastLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
