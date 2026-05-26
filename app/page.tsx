import { getLocale, setRequestLocale } from "next-intl/server"

import { HomePage } from "@/components/home/HomePage"

/** ISR shell — role redirects run in middleware on `/`. */
export const revalidate = 60

export default async function Page() {
  const locale = await getLocale()
  setRequestLocale(locale)
  return <HomePage />
}
