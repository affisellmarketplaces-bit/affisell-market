import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { CategoryBrowseGrid } from "@/components/browse/category-browse-grid"
import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"
import {
  buildCategoryBreadcrumbJsonLd,
  categoryBrowsePath,
  loadBrowseCategoryBySlug,
  loadBrowseCategoryListings,
} from "@/lib/seo-category-pages"
import { resolveSiteBaseUrl } from "@/lib/seo-site-url"

/**
 * next-intl getTranslations/getLocale use request APIs → DYNAMIC_SERVER_USAGE
 * if this page is treated as static/ISR. Force dynamic SSR (SEO still fine).
 */
export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ categorySlug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorySlug } = await params
  const category = await loadBrowseCategoryBySlug(categorySlug)
  if (!category) return { title: "Catégorie", robots: { index: false, follow: false } }

  const t = await getTranslations("browseCategory")
  const title = category.metaTitle?.trim() || t("metaTitle", { category: category.name })
  const description =
    category.metaDesc?.trim() ||
    t("metaDescription", { category: category.name, count: category.listingCount })
  const canonical = `${resolveSiteBaseUrl()}${categoryBrowsePath(category.slug)}`
  const indexable = category.listingCount > 0

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
  }
}

export default async function CategoryBrowsePage({ params }: PageProps) {
  const { categorySlug } = await params
  const category = await loadBrowseCategoryBySlug(categorySlug)
  if (!category) notFound()

  const [t, locale, listings] = await Promise.all([
    getTranslations("browseCategory"),
    getLocale(),
    loadBrowseCategoryListings(category.id, 24),
  ])

  const explorerHref = marketplaceCatalogHref("/", { category: category.id })
  const breadcrumbJsonLd = buildCategoryBreadcrumbJsonLd(category)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-violet-700 dark:hover:text-violet-300">
              {t("breadcrumbHome")}
            </Link>
          </li>
          <li aria-hidden>›</li>
          {category.parent ? (
            <>
              <li>
                <Link
                  href={categoryBrowsePath(category.parent.slug)}
                  className="hover:text-violet-700 dark:hover:text-violet-300"
                >
                  {category.parent.name}
                </Link>
              </li>
              <li aria-hidden>›</li>
            </>
          ) : null}
          <li className="font-medium text-zinc-800 dark:text-zinc-200">{category.name}</li>
        </ol>
      </nav>

      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{category.name}</h1>
        {category.fullPath ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{category.fullPath}</p>
        ) : null}
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
          {category.metaDesc?.trim() ||
            t("metaDescription", { category: category.name, count: category.listingCount })}
        </p>
        <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
          {t("listingCount", { count: category.listingCount })}
        </p>
      </header>

      {category.children.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("subcategories")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {category.children.map((child) => (
              <li key={child.slug}>
                <Link
                  href={categoryBrowsePath(child.slug)}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  {child.name}
                  <span className="text-zinc-400">({child.count})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {listings.length > 0 ? (
        <CategoryBrowseGrid items={listings} />
      ) : (
        <p className="text-sm text-zinc-500">{t("empty")}</p>
      )}

      <div className="mt-10">
        <Link
          href={explorerHref}
          className="inline-flex items-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          {t("seeAll")}
        </Link>
      </div>

      <p className="sr-only" lang={locale}>
        {category.name}
      </p>
    </main>
  )
}
