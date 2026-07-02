import { getTranslations } from "next-intl/server"

import { BentoCard, BentoContainer, BentoShell } from "@/components/affisell/bento-ui"
import { ContactForm } from "@/components/legal/contact-form"
import { readCompanyLegal } from "@/lib/legal/company-env"

export async function generateMetadata() {
  const t = await getTranslations("contact")
  return {
    title: t("metaTitle"),
    description: t("description"),
  }
}

export default async function ContactPage() {
  const t = await getTranslations("contact")
  const { supportEmail } = readCompanyLegal()

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-10 sm:py-14">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            {t("eyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{t("title")}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("description")}</p>
        </header>
        <BentoCard className="overflow-visible p-6 sm:p-8">
          <ContactForm supportEmail={supportEmail} />
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
