"use client"

import { ArrowRight, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { FastLink } from "@/components/navigation/fast-link"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { catalogFilterHref } from "@/lib/marketplace-catalog-nav.client"
import { categoryRailHref } from "@/lib/marketplace-category-rail-href.client"
import type { HomeCollection } from "@/lib/home-collections"
import type { BrowseDepartmentTheme } from "@/lib/taxonomy/browse-departments-shared"
import { cn } from "@/lib/utils"

export type DiscoveryEntry = { id: string; label: string; icon: string; categoryId: string; categorySlug: string; count: number }
export type DiscoveryGroup = { theme: BrowseDepartmentTheme; entries: DiscoveryEntry[] }

const PANEL =
  "rounded-3xl border border-white/60 bg-white/50 shadow-[0_10px_40px_-16px_rgba(76,29,149,0.25),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-150"

function scrollToExplorer() {
  window.setTimeout(() => document.getElementById("explorer")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
}

function CollectionCard({ collection }: { collection: HomeCollection }) {
  const t = useTranslations("homeDiscovery")
  const title =
    collection.kind === "category" ? collection.title : t("priceTitle", { amount: `${collection.maxEur} €` })
  const href =
    collection.kind === "category"
      ? categoryRailHref("/", { id: collection.categoryId, slug: "" })
      : catalogFilterHref("/", `price=under${collection.maxEur}`)

  return (
    <article className={cn(PANEL, "flex min-w-0 flex-col p-4")}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-[17px] font-bold leading-snug tracking-tight text-[#14103a]">{title}</h3>
        <FastLink
          href={href}
          scroll={false}
          onClick={scrollToExplorer}
          aria-label={t("seeAllIn", { name: title })}
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[#472488] transition hover:bg-white/70"
        >
          <ArrowRight className="size-[18px]" aria-hidden />
        </FastLink>
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {collection.tiles.map((tile) => (
          <li key={tile.id} className="min-w-0">
            <FastLink href={tile.href} prefetch={false} className="group block">
              <span className="relative block aspect-square overflow-hidden rounded-xl bg-[#F3F0FC] ring-1 ring-white/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                />
              </span>
              <span className="mt-1.5 block truncate text-[13px] text-zinc-800">{tile.title}</span>
              <span className="block text-[13px] font-semibold tabular-nums text-[#4C2FB8]">
                {formatStoreCurrencyFromCents(tile.priceCents)}
              </span>
            </FastLink>
          </li>
        ))}
      </ul>
    </article>
  )
}

function Directory({ groups }: { groups: DiscoveryGroup[] }) {
  const t = useTranslations("homeDiscovery")
  const stocked = groups
    .map((g) => ({ theme: g.theme, entries: g.entries.filter((e) => e.count > 0) }))
    .filter((g) => g.entries.length > 0)
  const empty = groups.flatMap((g) => g.entries.filter((e) => e.count === 0))
  if (stocked.length === 0 && empty.length === 0) return null

  return (
    <section aria-labelledby="home-directory-heading" className="min-w-0">
      <div className="mb-4">
        <h2 id="home-directory-heading" className="text-2xl font-bold tracking-tight text-[#14103a]">
          {t("directoryTitle")}
        </h2>
        <p className="mt-1 text-[15px] text-zinc-600">{t("directorySub")}</p>
      </div>

      {stocked.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stocked.map((g) => (
            <div key={g.theme} className={cn(PANEL, "p-4")}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#472488]">{t(`themes.${g.theme}`)}</h3>
              <ul className="space-y-0.5">
                {g.entries.map((e) => (
                  <li key={e.id}>
                    <FastLink
                      href={categoryRailHref("/", { id: e.categoryId, slug: e.categorySlug })}
                      scroll={false}
                      onClick={scrollToExplorer}
                      className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-[15px] text-[#14103a] transition hover:bg-white/70"
                    >
                      <span className="w-6 text-center text-lg leading-none" aria-hidden>{e.icon}</span>
                      <span className="min-w-0 flex-1 truncate">{e.label}</span>
                      <span className="text-xs tabular-nums text-zinc-500">{e.count}</span>
                    </FastLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {empty.length > 0 ? (
        <details className={cn(PANEL, "group mt-4 p-4")}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-[#14103a]">
            <span>{t("emptyTitle", { count: empty.length })}</span>
            <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="mt-2 text-sm text-zinc-600">{t("emptyBody")}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {empty.map((e) => (
              <li key={e.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#8B6ED6]/[0.14] px-3 py-1.5 text-sm text-[#14103a]/80">
                <span aria-hidden>{e.icon}</span>
                {e.label}
              </li>
            ))}
          </ul>
          <Link
            href="/signup/supplier"
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-[#7C4DF0] to-[#5B35D8] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(91,53,216,0.7)] transition hover:brightness-110"
          >
            {t("sellCta")}
          </Link>
        </details>
      ) : null}
    </section>
  )
}

/** Below the fold of the glass catalog: real-product mosaics, budget collections and the full department directory. */
export function HomeDiscoverySection({ collections, directory }: { collections: HomeCollection[]; directory: DiscoveryGroup[] }) {
  const t = useTranslations("homeDiscovery")
  if (collections.length === 0 && directory.length === 0) return null
  // Only claim "by department" when department mosaics actually exist; otherwise this is the budget section.
  const hasDepartments = collections.some((c) => c.kind === "category")
  return (
    <div className="min-w-0 space-y-8">
      {collections.length > 0 ? (
        <section aria-labelledby="home-collections-heading" className="min-w-0">
          <div className="mb-4">
            <h2 id="home-collections-heading" className="text-2xl font-bold tracking-tight text-[#14103a]">
              {hasDepartments ? t("collectionsTitle") : t("budgetTitle")}
            </h2>
            <p className="mt-1 text-[15px] text-zinc-600">{hasDepartments ? t("collectionsSub") : t("budgetSub")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {collections.map((c) => (
              <CollectionCard key={c.key} collection={c} />
            ))}
          </div>
        </section>
      ) : null}
      <Directory groups={directory} />
    </div>
  )
}
