import type { Metadata } from "next"
import Link from "next/link"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import {
  loginCustomerPath,
  MARKETPLACE_BUYER_ORDERS_PATH,
  signupCustomerPath,
} from "@/lib/login-redirect"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Suivre ma commande | Affisell",
  description: "Suivi de commande Affisell — numéro de suivi et statut dans votre espace client.",
}

const ORDERS_CALLBACK = MARKETPLACE_BUYER_ORDERS_PATH

export default function TrackOrderPage() {
  const loginHref = loginCustomerPath(ORDERS_CALLBACK)
  const signupHref = signupCustomerPath(ORDERS_CALLBACK)

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <BentoPageHeading
          eyebrow="Livraison"
          title="Suivre ma commande"
          description="Connectez-vous avec votre compte client Affisell (même e-mail que lors du paiement) pour voir le statut, le suivi et gérer un retour."
        />
        <BentoCard className="mt-8 space-y-4 p-6">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>
              <strong>Se connecter</strong> ou <strong>créer un compte client</strong> avec l&apos;e-mail utilisé
              lors du paiement.
            </li>
            <li>Ouvrez « Mes commandes » pour le détail et le suivi transporteur.</li>
            <li>Un e-mail de confirmation vous est envoyé à chaque étape clé.</li>
          </ol>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={loginHref}
              className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }))}
            >
              Se connecter
            </Link>
            <Link href={signupHref} className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
              Créer un compte client
            </Link>
            <Link
              href={ORDERS_CALLBACK}
              className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}
            >
              Mes commandes
            </Link>
            <Link href="/contact" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
              Contacter le support
            </Link>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Vous êtes créateur ou fournisseur ?{" "}
            <Link href="/login" className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
              Connexion professionnelle
            </Link>
          </p>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
