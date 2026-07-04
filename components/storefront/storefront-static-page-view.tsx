import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getTranslations } from "next-intl/server"

import {
  STOREFRONT_STATIC_PAGE_KINDS,
  type StorefrontFaqItem,
  type StorefrontStaticPage,
  type StorefrontStaticPageKind,
} from "@/lib/storefront-static-pages-shared"
import { shopStaticPagePath } from "@/lib/storefront-static-page-paths"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  kind: StorefrontStaticPageKind
  page: StorefrontStaticPage
  shopHomePath: string
  enabledKinds: StorefrontStaticPageKind[]
}

export async function StorefrontStaticPageView({
  storeName,
  kind,
  page,
  shopHomePath,
  enabledKinds,
}: Props) {
  const t = await getTranslations("storefront.staticPages")

  const title = page.title?.trim() || t(`defaults.${kind}.title`, { name: storeName })
  const body = page.body?.trim() || t(`defaults.${kind}.body`, { name: storeName })

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href={shopHomePath}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-violet-700 hover:underline dark:text-violet-300"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("backToStore", { name: storeName })}
      </Link>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
          {storeName}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          {title}
        </h1>
      </header>

      {kind === "faq" ? (
        <FaqList items={page.faqItems ?? []} fallbackBody={body} />
      ) : (
        <div className="prose prose-zinc mt-8 max-w-none dark:prose-invert">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
            {body}
          </p>
        </div>
      )}

      {enabledKinds.length > 1 ? (
        <nav
          className="mt-12 flex flex-wrap gap-2 border-t border-zinc-200 pt-6 dark:border-zinc-800"
          aria-label={t("siblingNavAria")}
        >
          {STOREFRONT_STATIC_PAGE_KINDS.filter(
            (k) => k !== kind && enabledKinds.includes(k)
          ).map((k) => (
            <Link
              key={k}
              href={shopStaticPagePath(shopHomePath, k)}
              className={cn(
                "rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700",
                "hover:border-violet-300 hover:text-violet-800 dark:border-zinc-700 dark:text-zinc-200"
              )}
            >
              {t(`nav.${k}`)}
            </Link>
          ))}
        </nav>
      ) : null}
    </article>
  )
}

function FaqList({ items, fallbackBody }: { items: StorefrontFaqItem[]; fallbackBody: string }) {
  if (items.length === 0) {
    return (
      <p className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
        {fallbackBody}
      </p>
    )
  }

  return (
    <ul className="mt-8 space-y-4">
      {items.map((item) => (
        <li
          key={item.question}
          className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80"
        >
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">{item.question}</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{item.answer}</p>
        </li>
      ))}
    </ul>
  )
}
