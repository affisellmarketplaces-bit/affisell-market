import type { Metadata } from "next"
import Link from "next/link"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Livraison | Affisell",
  description: "Délais de livraison Affisell, suivi colis et expédition sécurisée.",
}

export default function ShippingPage() {
  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-12">
        <BentoPageHeading
          eyebrow="Livraison"
          title="Livraison & suivi"
          description="Expédition par nos partenaires fournisseurs — suivi et notifications automatiques à chaque étape."
        />

        <BentoCard className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Délais indicatifs</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>
              <strong>France &amp; UE :</strong> 3 à 7 jours ouvrés après expédition (selon produit et entrepôt).
            </li>
            <li>
              <strong>International :</strong> 7 à 14 jours ouvrés — douanes éventuelles à la charge de l&apos;acheteur.
            </li>
            <li>Le délai exact est affiché sur la fiche produit avant paiement.</li>
          </ul>
        </BentoCard>

        <BentoCard className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Suivi automatique</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>E-mail de confirmation dès le paiement validé (Stripe).</li>
            <li>E-mail d&apos;expédition avec numéro de suivi transporteur.</li>
            <li>E-mail à la livraison + rappel avis J+7.</li>
          </ol>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/track-order" className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }))}>
              Suivre ma commande
            </Link>
            <Link href="/marketplace/account/orders" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
              Mes commandes
            </Link>
          </div>
        </BentoCard>

        <BentoCard className="space-y-3 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Retard ou colis manquant ?</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Si le délai affiché est dépassé sans tracking, notre système Ship Pulse peut annuler et rembourser
            automatiquement. Sinon, consultez l&apos;assistant support ou la FAQ.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/support" className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }))}>
              Assistant support
            </Link>
            <Link href="/faq" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
              FAQ
            </Link>
          </div>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
