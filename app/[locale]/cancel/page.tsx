import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"

export default async function CancelPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params
  const t = await getTranslations("cancel")

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">{t("body")}</p>
      <Link href="/marketplace" className="mt-8 inline-block text-sm underline">
        {t("backMarketplace")}
      </Link>
    </main>
  )
}
