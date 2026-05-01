import { getTranslations } from "next-intl/server"

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params
  const t = await getTranslations("home")

  return (
    <main className="mx-auto max-w-2xl p-10" style={{ fontFamily: "sans-serif" }}>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      <p className="mt-2 text-sm text-zinc-500">{t("apiOk")}</p>
    </main>
  )
}
