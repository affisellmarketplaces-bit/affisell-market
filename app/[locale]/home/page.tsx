import { redirect } from "next/navigation"

type Props = { params: Promise<{ locale: string }> }

/** `/fr/home`, `/en/home` → localized home. */
export default async function LocalizedHomeAliasPage({ params }: Props) {
  const { locale } = await params
  redirect(`/${locale}`)
}
