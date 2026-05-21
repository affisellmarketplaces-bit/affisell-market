import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { hasLocale } from "next-intl"

import { routing } from "@/i18n/routing"

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

/** Only en and fr match; paths like /agent use dedicated app routes outside [locale]. */
export const dynamicParams = false

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return children
}
