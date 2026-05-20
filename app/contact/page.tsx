import Link from "next/link"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Contact — Affisell",
}

export default function ContactPage() {
  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <BentoPageHeading
          eyebrow="Support"
          title="Contactez Affisell"
          description="Une question sur une commande, un retour ou votre portefeuille cashback ? Écrivez-nous, nous répondons sous 48 h ouvrées."
        />
        <BentoCard className="mt-8 space-y-4 p-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            E-mail :{" "}
            <a
              href="mailto:support@affisell.com"
              className="font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
            >
              support@affisell.com
            </a>
          </p>
          <Link href="/marketplace/account" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
            ← Retour à mon espace client
          </Link>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
