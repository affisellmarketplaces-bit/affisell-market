import { getTranslations, setRequestLocale } from "next-intl/server"

import { HomePage } from "@/components/home/HomePage"
import { routing } from "@/i18n/routing"

export const revalidate = 60

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "home.meta" })
  return {
    title: t("title"),
    description: t("description"),
  }
}

/** French home at `/fr`. English home is `app/page.tsx` at `/`. */
export default async function LocaleHomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale === routing.defaultLocale ? routing.defaultLocale : locale)
  return <HomePage />
}
