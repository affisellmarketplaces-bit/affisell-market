import { Check, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import { BuyerHeroSearch } from "@/components/BuyerHeroSearch"
import { RotatingSloganPro } from "@/components/ui/RotatingSloganPro"
import { BUYER_PREMIUM_TRUST_PILLS } from "@/lib/buyer-premium-home-content"
import { BUYER_PREMIUM } from "@/lib/buyer-premium-home-tokens"
import { cn } from "@/lib/utils"

/**
 * Buyer home hero — the LCP block. A SERVER component on purpose: it used to be a client
 * component wrapping its content in a framer-motion <motion.div initial={false}> — an animation
 * that never ran (initial={false} starts at the final state) but put framer-motion (~44 KB gzip)
 * and the whole hero's hydration on the home page's critical path. Only the two interactive
 * leaves (the search box and the rotating slogan) are client components now.
 */
export function BuyerPremiumHero() {
  const t = useTranslations("home.hero")
  const tSlogan = useTranslations("slogans.buyer")
  const rotatifs = tSlogan.raw("rotatifs") as string[]

  return (
    <section
      className={cn(
        "relative overflow-visible px-1 pb-10 pt-6 sm:px-2 sm:pb-12 sm:pt-8 md:pb-14 md:pt-10"
      )}
      data-testid="buyer-premium-hero"
    >
      <div className="relative mx-auto max-w-3xl text-center">
        <div
          className="mb-5 inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-xs font-semibold shadow-sm backdrop-blur-md"
          style={{
            backgroundColor: BUYER_PREMIUM.badge.heroBg,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: BUYER_PREMIUM.badge.heroBorder,
            color: BUYER_PREMIUM.badge.heroText,
          }}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 shadow-sm shadow-violet-600/40">
            <ShieldCheck className="size-3 text-white" strokeWidth={2.5} aria-hidden />
          </span>
          {t("badgeLabel")}
        </div>

        <RotatingSloganPro
          persona="buyer"
          base={t("titlePremium")}
          phrases={rotatifs}
          fixedSuffix={null}
          canonical={`${t("titlePremium")} ${rotatifs[0] ?? ""}`}
          className="text-balance text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl md:text-[2.65rem] lg:text-[2.65rem]"
        />
        <p
          data-testid="buyer-hero-subtitle"
          className="mx-auto mt-4 max-w-2xl text-pretty text-sm font-medium leading-relaxed tracking-[0.01em] sm:text-base sm:leading-7"
          style={{
            color: BUYER_PREMIUM.hero.subline,
            textShadow: BUYER_PREMIUM.hero.sublineShadow,
          }}
        >
          {t("subPremium")}
        </p>

        <div className="mx-auto mt-8 max-w-2xl">
          <BuyerHeroSearch premium />
        </div>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {BUYER_PREMIUM_TRUST_PILLS.map((label) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium shadow-sm"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: BUYER_PREMIUM.trust.pillBorder,
                color: BUYER_PREMIUM.trust.pillText,
              }}
            >
              <span
                className="flex size-4 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: BUYER_PREMIUM.trust.check }}
              >
                <Check className="size-2.5" strokeWidth={3} aria-hidden />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
