import type { Metadata } from "next"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { ContactForm } from "@/components/legal/contact-form"
import { readCompanyLegal } from "@/lib/legal/company-env"

export const metadata: Metadata = {
  title: "Contact | Affisell",
  description: "Contactez le support Affisell — commandes, retours, partenariats.",
}

export default function ContactPage() {
  const { supportEmail } = readCompanyLegal()

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-10 sm:py-14">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Support
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Contact</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Une question sur une commande, un retour ou un compte fournisseur / affilié ? Écrivez-nous.
          </p>
        </header>
        <BentoCard className="overflow-visible p-6 sm:p-8">
          <ContactForm supportEmail={supportEmail} />
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
