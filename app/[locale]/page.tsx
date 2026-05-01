import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  await params
  const t = await getTranslations("home")

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{t("title")}</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/signup?role=SUPPLIER"
          className="rounded-lg bg-zinc-900 px-6 py-3 text-center font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {t("becomeSupplier")}
        </Link>
        <Link
          href="/signup?role=AFFILIATE"
          className="rounded-lg border border-zinc-300 px-6 py-3 text-center font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          {t("becomeAffiliate")}
        </Link>
        <Link
          href="/marketplace"
          className="rounded-lg border border-zinc-300 px-6 py-3 text-center font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          {t("browseMarketplace")}
        </Link>
      </div>
    </main>
  )
}
