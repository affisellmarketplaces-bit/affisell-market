import type { Metadata } from "next"
import Link from "next/link"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { SupportAgentChat } from "@/components/support/support-agent-chat"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Assistant support | Affisell",
  description: "Assistant support Affisell — commandes, livraison, retours et remboursements.",
}

export default function SupportPage() {
  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-12">
        <BentoPageHeading
          eyebrow="Support"
          title="Assistant Support Affisell"
          description="Réponses instantanées sur vos commandes, livraisons et retours — avant d'écrire au support humain."
        />

        <SupportAgentChat />

        <div className="grid gap-4 sm:grid-cols-3">
          <BentoCard className="p-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">FAQ</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">10+ réponses sur commandes, livraison, cashback.</p>
            <Link href="/faq" className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 px-0")}>
              Ouvrir →
            </Link>
          </BentoCard>
          <BentoCard className="p-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Mes commandes</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Suivi, retours et confirmation de livraison.</p>
            <Link
              href="/marketplace/account/orders"
              className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 px-0")}
            >
              Accéder →
            </Link>
          </BentoCard>
          <BentoCard className="p-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Contact humain</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Réponse sous 48 h ouvrées si l&apos;assistant ne suffit pas.</p>
            <Link href="/contact" className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 px-0")}>
              Écrire →
            </Link>
          </BentoCard>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
