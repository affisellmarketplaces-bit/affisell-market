import type { Metadata } from "next"
import Link from "next/link"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Suivre ma commande | Affisell",
  description: "Suivi de commande Affisell — numéro de suivi et statut dans votre espace client.",
}

export default function TrackOrderPage() {
  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <BentoPageHeading
          eyebrow="Livraison"
          title="Suivre ma commande"
          description="Connectez-vous pour voir le statut, le numéro de suivi et gérer un retour éventuel."
        />
        <BentoCard className="mt-8 space-y-4 p-6">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>Connectez-vous avec l&apos;email utilisé lors du paiement.</li>
            <li>Ouvrez « Mes commandes » pour le détail et le suivi transporteur.</li>
            <li>Un email de confirmation vous est envoyé à chaque étape clé.</li>
          </ol>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/marketplace/account/orders"
              className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }))}
            >
              Mes commandes
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
              Se connecter
            </Link>
            <Link href="/contact" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
              Contacter le support
            </Link>
          </div>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
