import Link from "next/link"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "FAQ — Affisell",
}

export default function FaqPage() {
  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-12">
        <BentoPageHeading
          eyebrow="Aide"
          title="Questions fréquentes"
          description="Retours, livraisons et avantages acheteurs sur le marketplace Affisell."
        />

        <BentoCard id="cashback" className="scroll-mt-24 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Comment gagner du cashback ?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Sur les fiches produits partenaires, une partie du prix peut être créditée en portefeuille
            après paiement confirmé. Connectez-vous avant le checkout : le solde s&apos;applique
            automatiquement sur votre prochain achat éligible.
          </p>
          <Link
            href="/marketplace/account/wallet"
            className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }), "mt-4 inline-flex")}
          >
            Voir mon portefeuille
          </Link>
        </BentoCard>

        <Link href="/marketplace" className="text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300">
          ← Retour au marketplace
        </Link>
      </BentoContainer>
    </BentoShell>
  )
}
