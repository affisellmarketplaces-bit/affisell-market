"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
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
  name: string
  audience: string
  monthly: number
  annual: number
  icon: "rocket" | "crown" | null
  features: string[]
  cta: string
  href: string
  popular?: boolean
}

const TIERS: Tier[] = [
  {
    id: "lanceur",
    name: "Lanceur",
    audience: "Pour Resellers",
    monthly: 29,
    annual: 290,
    icon: "rocket",
    features: [
      "50 produits/semaine FR/ES",
      "Import 1-clic",
      "Max 100 commandes/mois",
      "Support Discord",
    ],
    cta: "Commencer à revendre",
    href: "/signup?role=reseller&plan=lanceur",
  },
  {
    id: "dominator",
    name: "Dominator",
    audience: "Pour Grossistes",
    monthly: 79,
    annual: 790,
    icon: null,
    popular: true,
    features: [
      "Tout Lanceur",
      "Radar Grossiste - Sourcing GMC",
      "Stock FR + livraison 24/48h certifiée",
      "Priorité algo resellers",
      "Illimité",
      "Support prioritaire",
    ],
    cta: "Devenir Dominator",
    href: "/signup?role=supplier&plan=dominator",
  },
  {
    id: "empire",
    name: "Empire",
    audience: "Pour Marques",
    monthly: 149,
    annual: 990,
    icon: "crown",
    features: [
      "Tout Dominator",
      "Cockpit Défense — empire & police des prix",
      "Protection prix",
      "Accès Top 20 Resellers",
      "Coaching 1h/mois",
    ],
    cta: "Bâtir mon Empire",
    href: "/signup?role=supplier&plan=empire",
  },
]

type Props = {
  kindHint?: PricingKindHint
}

export function AffisellGrowthPricing({ kindHint = null }: Props) {
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
            Mensuel
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
            Annuel
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
                  Radar Grossiste - Recommandé pour toi
                </span>
              </>
            ) : (
              <>
                Profil détecté :{" "}
                <span className="font-semibold text-[#7C3AED]">Producteur</span> — plan recommandé
                mis en avant.
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
                  Le plus choisi
                </span>
              ) : null}
              {isRecommended ? (
                <span className="absolute -top-3 right-4 z-[2] rounded-full border border-violet-300 bg-white px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#7C3AED] uppercase dark:border-violet-700 dark:bg-zinc-950">
                  {kindHint === "stocker" ? "Radar Grossiste" : "Recommandé pour toi"}
                </span>
              ) : null}

              <CardHeader className="gap-3 pt-6">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg text-zinc-900 dark:text-white">{tier.name}</CardTitle>
                    <CardDescription>{tier.audience}</CardDescription>
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
                    /{billing === "monthly" ? "mois" : "an"}
                  </span>
                </p>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                  {tier.features.map((f) => (
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
                    {tier.cta}
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
