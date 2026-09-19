"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Check, Crown, Rocket } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { track } from "@/lib/analytics"
import { cn } from "@/lib/utils"

export type PricingKindHint = "producer" | "stocker" | null

type Billing = "monthly" | "annual"

type TierId = "lanceur" | "dominator" | "empire"

type Tier = {
  id: TierId
  monthly: number
  annual: number
  icon: "rocket" | "crown" | null
  href: string
  popular?: boolean
}

const TIERS: Tier[] = [
  { id: "lanceur", monthly: 29, annual: 290, icon: "rocket", href: "/signup?role=reseller&plan=lanceur" },
  { id: "dominator", monthly: 79, annual: 790, icon: null, popular: true, href: "/signup?role=supplier&plan=dominator" },
  { id: "empire", monthly: 149, annual: 990, icon: "crown", href: "/signup?role=supplier&plan=empire" },
]

type Props = {
  kindHint?: PricingKindHint
}

export function AffisellGrowthPricing({ kindHint = null }: Props) {
  const t = useTranslations("pricingGrowth")
  const [billing, setBilling] = useState<Billing>("monthly")

  const recommendedId: TierId | null = useMemo(() => {
    if (kindHint === "producer") return "empire"
    if (kindHint === "stocker") return "dominator"
    return null
  }, [kindHint])

  return (
    <section className="mt-4 space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white/80 p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              billing === "monthly"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
            )}
          >
            {t("monthly")}
          </button>
          <button
            type="button"
            onClick={() => setBilling("annual")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              billing === "annual"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
            )}
          >
            {t("annual")}
            <span className="ml-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              −20%
            </span>
          </button>
        </div>
        {kindHint ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {kindHint === "stocker" ? (
              <>
                <span className="font-semibold text-[#7C3AED]">
                  {t("wholesaleRadarRecommended")}
                </span>
              </>
            ) : (
              <>
                {t("profileDetected")}{" "}
                <span className="font-semibold text-[#7C3AED]">{t("producer")}</span> — {t("recommendedPlanHighlighted")}
              </>
            )}
          </p>
        ) : null}
      </div>

      <div className="grid items-stretch gap-5 lg:grid-cols-3">
        {TIERS.map((tier) => {
          const price = billing === "monthly" ? tier.monthly : tier.annual
          const isRecommended = recommendedId === tier.id
          const isDominator = tier.id === "dominator"
          const highlight = isRecommended || (isDominator && !recommendedId)

          return (
            <Card
              key={tier.id}
              className={cn(
                "relative flex h-full flex-col border bg-white/80 backdrop-blur-xl transition dark:bg-zinc-950/80",
                highlight
                  ? "z-[1] scale-[1.02] border-violet-500 bg-violet-500/5 shadow-xl shadow-violet-500/20 lg:scale-105 dark:bg-violet-500/10"
                  : "border-zinc-200/80 dark:border-zinc-800",
                isDominator && "ring-1 ring-violet-400/40"
              )}
            >
              {isDominator ? (
                <span className="absolute -top-3 left-1/2 z-[2] -translate-x-1/2 animate-pulse rounded-full bg-[#7C3AED] px-3 py-1 text-[10px] font-bold tracking-wide text-white uppercase shadow-lg shadow-violet-500/40">
                  {t("mostChosen")}
                </span>
              ) : null}
              {isRecommended ? (
                <span className="absolute -top-3 right-4 z-[2] rounded-full border border-violet-300 bg-white px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#7C3AED] uppercase dark:border-violet-700 dark:bg-zinc-950">
                  {kindHint === "stocker" ? t("wholesaleRadar") : t("recommendedForYou")}
                </span>
              ) : null}

              <CardHeader className="gap-3 pt-6">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg text-zinc-900 dark:text-white">{tier.id === "lanceur" ? "Lanceur" : tier.id === "dominator" ? "Dominator" : "Empire"}</CardTitle>
                    <CardDescription>{t(`${tier.id}.audience`)}</CardDescription>
                  </div>
                  {tier.icon === "rocket" ? (
                    <span className="inline-flex size-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
                      <Rocket className="size-5" />
                    </span>
                  ) : null}
                  {tier.icon === "crown" ? (
                    <span className="inline-flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      <Crown className="size-5" />
                    </span>
                  ) : null}
                </div>
                <p className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                  {price}€
                  <span className="text-sm font-normal text-zinc-500">
                    /{billing === "monthly" ? t("perMonth") : t("perYear")}
                  </span>
                </p>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                  {(t.raw(`${tier.id}.f`) as string[]).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-[#7C3AED]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  asChild
                  variant={highlight ? "bentoAccent" : "bentoOutline"}
                  className="w-full"
                  size="lg"
                >
                  <Link
                    href={tier.href}
                    onClick={() =>
                      track("pricing_cta_clicked", {
                        plan: tier.id,
                        kind_hint: kindHint,
                        location: "growth_pricing_section",
                        billing,
                      })
                    }
                  >
                    {t(`${tier.id}.cta`)}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
