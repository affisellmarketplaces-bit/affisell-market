import { getTranslations } from "next-intl/server"

import { GlowCtaLink } from "@/components/GlowCtaLink"
import { HeroGradientBg } from "@/components/marketing/hero-gradient-bg"
import { Link } from "@/i18n/navigation"

type Persona = "creators" | "partners"

type Props = {
  persona: Persona
  ctaHref: string
  footerHref?: string
  footerKey?: "footerLink" | "backCreators"
}

export async function PersonaLandingHero({ persona, ctaHref, footerHref, footerKey }: Props) {
  const t = await getTranslations(`${persona}.hero`)
  const tPage = await getTranslations(persona)

  return (
    <section className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-700 via-indigo-800 to-sky-900 px-4 py-12 text-white shadow-xl sm:px-10 sm:py-16">
      <HeroGradientBg />
      <div className="relative mx-auto max-w-4xl text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">{t("title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-violet-100/95 sm:text-base">{t("sub")}</p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <GlowCtaLink href={ctaHref}>{t("cta")}</GlowCtaLink>
          {footerHref && footerKey ? (
            <Link
              href={footerHref}
              className="text-sm font-medium text-violet-100/90 underline-offset-4 hover:text-white hover:underline"
            >
              {tPage(footerKey)}
            </Link>
          ) : null}
        </div>
        {persona === "creators" ? (
          <ul className="mt-10 flex flex-wrap justify-center gap-3 text-sm font-semibold">
            <li className="rounded-full bg-white/10 px-4 py-2">{t("badgeCreators")}</li>
            <li className="rounded-full bg-white/10 px-4 py-2">{t("badgeRevenue")}</li>
            <li className="rounded-full bg-white/10 px-4 py-2">{t("badgeSetup")}</li>
          </ul>
        ) : null}
      </div>
    </section>
  )
}
