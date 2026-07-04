import Link from "next/link"
import { getTranslations } from "next-intl/server"

import {
  getEnabledStaticPages,
  type StorefrontStaticPages,
} from "@/lib/storefront-static-pages-shared"
import { shopStaticPagePath } from "@/lib/storefront-static-page-paths"

type Props = {
  storeName: string
  shopHomePath: string
  staticPages: StorefrontStaticPages | undefined
}

/** Footer strip linking to enabled store static pages. */
export async function StorefrontStaticPagesStrip({
  storeName,
  shopHomePath,
  staticPages,
}: Props) {
  const enabled = getEnabledStaticPages(staticPages)
  if (enabled.length === 0) return null

  const t = await getTranslations("storefront.staticPages")

  return (
    <nav
      className="border-t border-zinc-200/80 bg-white/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/80"
      aria-label={t("stripAria", { name: storeName })}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {enabled.map((kind) => (
          <Link
            key={kind}
            href={shopStaticPagePath(shopHomePath, kind)}
            className="text-xs font-semibold text-zinc-600 underline-offset-4 hover:text-violet-700 hover:underline dark:text-zinc-400 dark:hover:text-violet-300"
          >
            {t(`nav.${kind}`)}
          </Link>
        ))}
      </div>
    </nav>
  )
}
