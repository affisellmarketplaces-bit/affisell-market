import { getTranslations } from "next-intl/server"

export default async function SuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "success" })

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>{t("thankYou")}</h1>
    </main>
  )
}
