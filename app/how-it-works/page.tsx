import type { Metadata } from "next"
import Link from "next/link"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Comment ça marche | Affisell",
  description:
    "Découvrez le parcours acheteur, partenaire créateur et fournisseur sur la marketplace Affisell.",
}

export default function HowItWorksPage() {
  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <BentoPageHeading
          eyebrow="Marketplace UE"
          title="Comment ça marche"
          description="Affisell réunit partenaires créateurs, fournisseurs et acheteurs — sans stock côté partenaire, avec livraison rapide et sécurisée assurée par le fournisseur."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <BentoCard className="p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">1. Acheteur</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Explorez le catalogue, payez en toute sécurité et suivez votre commande depuis votre espace.
            </p>
          </BentoCard>
          <BentoCard className="p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">2. Partenaire créateur</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Sélectionnez des produits, personnalisez votre vitrine et partagez-la — Affisell gère l&apos;expérience
              d&apos;achat de bout en bout.
            </p>
          </BentoCard>
          <BentoCard className="p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">3. Fournisseur</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Publiez votre catalogue, livrez rapidement et en toute sécurité, encaissez une fois la livraison
              confirmée.
            </p>
          </BentoCard>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/marketplace" className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }))}>
            Explorer le catalogue
          </Link>
          <Link href="/affiliate" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
            Devenir partenaire créateur
          </Link>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
