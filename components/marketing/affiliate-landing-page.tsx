import Link from "next/link"
import { ArrowRight, Scale, ShieldCheck, Sparkles, Wallet } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell, BentoStat } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const COMPARISON_ROWS = [
  { label: "Marge max", affisell: "300%", tpop: "30%", shopify: "20%" },
  { label: "Payout", affisell: "J+7", tpop: "J+30", shopify: "J+15" },
  { label: "Clawback", affisell: "Prorata", tpop: "100%", shopify: "100%" },
  {
    label: "Transparence légale",
    affisell: "Hash SHA-256",
    tpop: "Non",
    shopify: "Non",
  },
] as const

export function AffiliateMarketingLandingPage() {
  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-12 py-12 sm:py-16">
        <div className="space-y-8">
          <BentoPageHeading
            eyebrow="Programme affilié Affisell"
            title="Fixez vos prix. Gardez 75% de la marge."
            description="Vendez jusqu'à 300% du prix fournisseur. Payout Stripe J+7 garanti."
          />

          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup/affiliate"
              className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex gap-2")}
            >
              Devenir affilié gratuitement
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/login/affiliate" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
              Se connecter
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <BentoStat label="Marge max" value="300%" hint="Prix client vs. catalogue fournisseur" />
            <BentoStat label="Payout Stripe" value="J+7" hint="Virement hebdomadaire garanti" />
            <BentoStat label="Part marge" value="75%" hint="Vous fixez le prix de vente" />
          </div>
        </div>

        <section aria-labelledby="clawback-heading">
          <BentoCard className="border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-zinc-950 dark:to-orange-950/20">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                <Scale className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 space-y-3">
                <h2 id="clawback-heading" className="text-xl font-bold text-zinc-900 dark:text-white">
                  Transparence totale sur les remboursements
                </h2>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  Client remboursé = commission débitée au prorata. Exemple : Vente 100€, votre commission 30€,
                  refund J+15 → 30€ débités. Pas de surprise. Voir CGA art.5 —{" "}
                  <Link
                    href="/legal"
                    className="font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                  >
                    registre légal
                  </Link>
                  .
                </p>
              </div>
            </div>
          </BentoCard>
        </section>

        <section aria-labelledby="compare-heading" className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <h2 id="compare-heading" className="text-2xl font-bold text-zinc-900 dark:text-white">
              Pourquoi les créateurs choisissent Affisell
            </h2>
          </div>

          <BentoCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                    <th className="px-4 py-3 font-semibold" scope="col" />
                    <th
                      className="px-4 py-3 font-semibold text-violet-700 dark:text-violet-300"
                      scope="col"
                    >
                      Affisell
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      TPOP
                    </th>
                    <th className="px-4 py-3 font-semibold" scope="col">
                      Shopify Collabs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                    >
                      <th
                        className="px-4 py-4 font-medium text-zinc-900 dark:text-zinc-100"
                        scope="row"
                      >
                        {row.label}
                      </th>
                      <td className="px-4 py-4 font-semibold text-violet-700 dark:text-violet-300">
                        {row.affisell}
                      </td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-400">{row.tpop}</td>
                      <td className="px-4 py-4 text-zinc-600 dark:text-zinc-400">{row.shopify}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BentoCard>
        </section>

        <section aria-labelledby="payout-heading">
          <BentoCard className="flex flex-col gap-4 border-emerald-200/80 sm:flex-row sm:items-center dark:border-emerald-900/40">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Wallet className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="payout-heading" className="text-lg font-bold text-zinc-900 dark:text-white">
                Payout Stripe J+7
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Virements hebdomadaires sur votre compte Stripe Connect. Pas de seuil caché, pas de délai opaque —
                vous voyez chaque euro dans votre dashboard.
              </p>
            </div>
            <Link
              href="/signup/affiliate"
              className={cn(
                buttonVariants({ variant: "bentoSolid", size: "bento" }),
                "inline-flex shrink-0 gap-2 self-start sm:self-center"
              )}
            >
              Commencer
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </BentoCard>
        </section>

        <footer className="flex flex-col gap-3 border-t border-zinc-200 pt-8 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 leading-relaxed">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            <span>
              CGU/CGA hashées SHA-256. Consentement RGPD tracé. DPO :{" "}
              <a
                href="mailto:dpo@affisell.com"
                className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
              >
                dpo@affisell.com
              </a>
            </span>
          </p>
          <Link
            href="/legal"
            className="font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            Documents légaux
          </Link>
        </footer>
      </BentoContainer>
    </BentoShell>
  )
}
