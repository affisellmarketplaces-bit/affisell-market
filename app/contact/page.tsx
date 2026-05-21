import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("contact")
  return { title: t("metaTitle") }
}

export default async function ContactPage() {
  const t = await getTranslations("contact")

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <BentoCard className="mt-8 space-y-4 p-6">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("emailLabel")}{" "}
            <a
              href="mailto:support@affisell.com"
              className="font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
            >
              support@affisell.com
            </a>
          </p>
          <Link href="/marketplace/account" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
            {t("backAccount")}
          </Link>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
