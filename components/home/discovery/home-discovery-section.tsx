"use client"

import { ArrowRight, BadgeCheck, ChevronDown, ShieldCheck, Star, Store, Zap } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { FastLink } from "@/components/navigation/fast-link"
import { ScrollFadeRow } from "@/components/ui/scroll-fade-row"
import type { FlashDeal, HomeShop } from "@/lib/home-flash-shops.server"
import type { SelectionItem } from "@/lib/home-selection.server"
import { bucketSalesCount, shouldShowBuyerSalesCount } from "@/lib/listing-sales-count"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { catalogFilterHref } from "@/lib/marketplace-catalog-nav.client"
import { categoryRailHref } from "@/lib/marketplace-category-rail-href.client"
import type { HomeCollection } from "@/lib/home-collections"
import type { BrowseDepartmentTheme } from "@/lib/taxonomy/browse-departments-shared"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

export type DiscoveryEntry = { id: string; label: string; icon: string; categoryId: string; categorySlug: string; count: number }
export type DiscoveryGroup = { theme: BrowseDepartmentTheme; entries: DiscoveryEntry[] }

const PANEL =
  "rounded-3xl border border-white/60 bg-white/50 dark:border-white/10 dark:bg-zinc-900/55 shadow-[0_10px_40px_-16px_rgba(76,29,149,0.25),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-150"

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
        <h3 className="line-clamp-2 text-[17px] font-bold leading-snug tracking-tight text-[color:var(--glass-text)]">{title}</h3>
        <FastLink
          href={href}
          scroll={false}
          onClick={scrollToExplorer}
          aria-label={t("seeAllIn", { name: title })}
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[color:var(--glass-accent)] transition hover:bg-white/70 dark:hover:bg-white/10"
        >
          <ArrowRight className="size-[18px]" aria-hidden />
        </FastLink>
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {collection.tiles.map((tile) => (
          <li key={tile.id} className="min-w-0">
            <FastLink href={tile.href} prefetch={false} className="group block">
              <span className="relative block aspect-square overflow-hidden rounded-xl bg-[var(--glass-tile)] ring-1 ring-white/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                />
              </span>
              <span className="mt-1.5 block truncate text-[13px] text-[color:var(--glass-muted)]">{tile.title}</span>
              <span className="block text-[13px] font-semibold tabular-nums text-[color:var(--glass-accent)]">
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
        <h2 id="home-directory-heading" className="text-2xl font-bold tracking-tight text-[color:var(--glass-text)]">
          {t("directoryTitle")}
        </h2>
        <p className="mt-1 text-[15px] text-[color:var(--glass-muted)]">{t("directorySub")}</p>
      </div>

      {stocked.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stocked.map((g) => (
            <div key={g.theme} className={cn(PANEL, "p-4")}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--glass-accent)]">{t(`themes.${g.theme}`)}</h3>
              <ul className="space-y-0.5">
                {g.entries.map((e) => (
                  <li key={e.id}>
                    <FastLink
                      href={categoryRailHref("/", { id: e.categoryId, slug: e.categorySlug })}
                      scroll={false}
                      onClick={scrollToExplorer}
                      className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-2 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[#6D45E0]/70 text-[color:var(--glass-text)] transition hover:bg-white/70 dark:hover:bg-white/10"
                    >
                      <span className="w-6 text-center text-lg leading-none" aria-hidden>{e.icon}</span>
                      <span className="min-w-0 flex-1 truncate">{e.label}</span>
                      <span className="text-xs tabular-nums text-[color:var(--glass-muted)]">{e.count}</span>
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
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[#6D45E0]/70 font-semibold text-[color:var(--glass-text)]">
            <span>{t("emptyTitle", { count: empty.length })}</span>
            <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="mt-2 text-sm text-[color:var(--glass-muted)]">{t("emptyBody")}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {empty.map((e) => (
              <li key={e.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#8B6ED6]/[0.14] px-3 py-1.5 text-sm text-[color:var(--glass-text)]/80">
                <span aria-hidden>{e.icon}</span>
                {e.label}
              </li>
            ))}
          </ul>
          <Link
            href="/signup/supplier"
            className="mt-4 inline-flex min-h-11 items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#c4b5fd] focus-visible:ring-offset-2 bg-gradient-to-r from-[#7C4DF0] to-[#5B35D8] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(91,53,216,0.7)] transition hover:brightness-110"
          >
            {t("sellCta")}
          </Link>
        </details>
      ) : null}
    </section>
  )
}

/**
 * mm:ss countdown that is safe to server-render: the server (and first client render) show a fixed placeholder,
 * the real time only exists after mount — so hydration can never mismatch by a second.
 */
export function FlashCountdown({ endsAt, onEnd }: { endsAt: string; onEnd: () => void }) {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    const end = new Date(endsAt).getTime()
    const tick = () => {
      const ms = end - Date.now()
      if (ms <= 0) {
        setLeft(0)
        onEnd()
        return false
      }
      setLeft(ms)
      return true
    }
    if (!tick()) return
    const id = window.setInterval(() => {
      if (!tick()) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [endsAt, onEnd])

  const total = left == null ? null : Math.max(0, Math.floor(left / 1000))
  const text =
    total == null ? "--:--" : `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
  return (
    <span className={cn("tabular-nums font-black tracking-wider", total != null && total < 60 && "animate-pulse")} data-testid="flash-countdown">
      {text}
    </span>
  )
}

/* ── Flash sales: live Pulse-battle winners, same legal presentation as the product page ───────────────── */
function FlashCard({ deal, onExpire }: { deal: FlashDeal; onExpire: () => void }) {
  const t = useTranslations("homeFlash")
  const tOffer = useTranslations("product.offer")
  return (
    <FastLink
      href={deal.href}
      prefetch={false}
      className="group block w-[15.5rem] shrink-0 snap-start rounded-2xl bg-[var(--glass-card)] p-3 shadow-[0_4px_18px_-8px_rgba(76,29,149,0.25)] ring-1 ring-white/70 outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#6D45E0]/70 motion-reduce:transform-none dark:ring-white/10"
    >
      <span className="relative block aspect-square overflow-hidden rounded-xl bg-[var(--glass-tile)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={deal.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-contain p-2" />
        <span className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-black text-white">−{deal.pct}%</span>
      </span>
      <span className="mt-2 block line-clamp-2 min-h-[2.4rem] text-[14px] font-semibold leading-snug text-[color:var(--glass-text)]">{deal.title}</span>
      <span className="mt-1 block text-xl font-black tabular-nums tracking-tight text-red-600 dark:text-red-400">
        {formatStoreCurrencyFromCents(deal.flashPriceCents)}
      </span>
      <span className="block text-[11px] tabular-nums text-zinc-400 line-through">
        {tOffer("usualPrice", { price: formatStoreCurrencyFromCents(deal.usualPriceCents) })}
      </span>
      {deal.referenceCents ? (
        <span className="block text-[10px] leading-snug text-zinc-500">
          {tOffer("lowest30d", { price: formatStoreCurrencyFromCents(deal.referenceCents) })}
        </span>
      ) : null}
      <span className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
        <Zap className="size-3.5" aria-hidden />
        <span>{t("endsIn")}</span>
        <FlashCountdown endsAt={deal.endsAt} onEnd={onExpire} />
      </span>
    </FastLink>
  )
}

function FlashRail({ deals }: { deals: FlashDeal[] }) {
  const t = useTranslations("homeFlash")
  const [gone, setGone] = useState<Set<string>>(new Set())
  const live = deals.filter((d) => !gone.has(d.key))
  if (live.length === 0) return null
  return (
    <section aria-labelledby="home-flash-heading" className="min-w-0">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="home-flash-heading" className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[color:var(--glass-text)]">
            <Zap className="size-6 fill-red-500 text-red-500" aria-hidden />
            {t("title")}
          </h2>
          <p className="mt-1 text-[15px] text-[color:var(--glass-muted)]">{t("sub")}</p>
        </div>
        <FastLink href="/battles" className="shrink-0 rounded-md text-sm font-semibold text-[color:var(--glass-accent)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#6D45E0]/70">
          {t("seeBattles")}
        </FastLink>
      </div>
      <div className={cn(PANEL, "p-3")}>
        <ScrollFadeRow ariaLabel={t("title")} className="snap-x gap-4">
          {live.map((d) => (
            <FlashCard key={d.key} deal={d} onExpire={() => setGone((prev) => new Set(prev).add(d.key))} />
          ))}
        </ScrollFadeRow>
      </div>
    </section>
  )
}

/* ── Affisell selection: ranked by verifiable trust signals ─────────────────────────────────────── */
function SelectionRail({ items }: { items: SelectionItem[] }) {
  const t = useTranslations("homeSelection")
  const tShip = useTranslations("shipping")
  if (items.length === 0) return null
  return (
    <section aria-labelledby="home-selection-heading" className="min-w-0">
      <div className="mb-4">
        <h2 id="home-selection-heading" className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[color:var(--glass-text)]">
          <ShieldCheck className="size-6 text-emerald-600" aria-hidden />
          {t("title")}
        </h2>
        <p className="mt-1 text-[15px] text-[color:var(--glass-muted)]">{t("sub")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {items.map((it) => (
          <li key={it.id} className="min-w-0">
            <FastLink
              href={it.href}
              prefetch={false}
              className={cn(PANEL, "group block h-full p-3 outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#6D45E0]/70 motion-reduce:transform-none")}
            >
              <span className="relative block aspect-square overflow-hidden rounded-xl bg-[var(--glass-tile)] ring-1 ring-white/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-contain p-2 transition-transform duration-300 group-hover:scale-105" />
              </span>
              <span className="mt-2 block line-clamp-2 min-h-[2.4rem] text-[13px] font-semibold leading-snug text-[color:var(--glass-text)]">{it.title}</span>
              <span className="mt-0.5 block text-[15px] font-bold tabular-nums text-[color:var(--glass-accent)]">{formatStoreCurrencyFromCents(it.priceCents)}</span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[color:var(--glass-muted)]">
                {it.verified ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    {t("verified")}
                  </span>
                ) : null}
                {it.delivery ? <span>{tShip("deliveryDays", { min: it.delivery.min, max: it.delivery.max })}</span> : null}
                {it.rating ? (
                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                    {it.rating.toFixed(1)}
                    <Star className="size-3 fill-current" aria-hidden />({it.reviews})
                  </span>
                ) : null}
              </span>
            </FastLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ── Shops to discover ─────────────────────────────────────────────────────────────────────────── */
function ShopCard({ shop }: { shop: HomeShop }) {
  const t = useTranslations("homeShops")
  const sales = shouldShowBuyerSalesCount(shop.soldUnits) ? bucketSalesCount(shop.soldUnits) : null
  return (
    <FastLink
      href={`/shops/${encodeURIComponent(shop.slug)}`}
      className={cn(PANEL, "group flex min-w-0 items-center gap-3.5 p-4 outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#6D45E0]/70 motion-reduce:transform-none")}
    >
      <span
        className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-xl font-bold text-white shadow-sm ring-1 ring-white/70"
        style={{ backgroundColor: shop.accent }}
        aria-hidden
      >
        {shop.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logoUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
        ) : (
          shop.name.trim().charAt(0).toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[16px] font-bold text-[color:var(--glass-text)]">{shop.name}</span>
          {shop.verified ? <BadgeCheck className="size-4 shrink-0 text-emerald-600" aria-label={t("verified")} /> : null}
        </span>
        <span className="mt-0.5 block text-[13px] text-[color:var(--glass-muted)]">
          {t("products", { count: shop.listedCount })}
          {sales ? ` · ${t("sold", { count: sales.plus ? `${sales.value}+` : sales.value })}` : ""}
        </span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-[color:var(--glass-accent)] transition-transform group-hover:translate-x-0.5" aria-hidden />
    </FastLink>
  )
}

function ShopsRail({ shops }: { shops: HomeShop[] }) {
  const t = useTranslations("homeShops")
  if (shops.length === 0) return null
  return (
    <section aria-labelledby="home-shops-heading" className="min-w-0">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="home-shops-heading" className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[color:var(--glass-text)]">
            <Store className="size-6 text-[color:var(--glass-accent)]" aria-hidden />
            {t("title")}
          </h2>
          <p className="mt-1 text-[15px] text-[color:var(--glass-muted)]">{t("sub")}</p>
        </div>
        <FastLink href="/shops" className="shrink-0 rounded-md text-sm font-semibold text-[color:var(--glass-accent)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#6D45E0]/70">
          {t("allShops")}
        </FastLink>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shops.map((s) => (
          <li key={s.slug} className="min-w-0">
            <ShopCard shop={s} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Below the fold of the glass catalog: real-product mosaics, budget collections and the full department directory. */
export function HomeDiscoverySection({
  collections,
  directory,
  flash = [],
  shops = [],
  selection = [],
}: {
  collections: HomeCollection[]
  directory: DiscoveryGroup[]
  flash?: FlashDeal[]
  shops?: HomeShop[]
  selection?: SelectionItem[]
}) {
  const t = useTranslations("homeDiscovery")
  if (collections.length === 0 && directory.length === 0 && flash.length === 0 && shops.length === 0 && selection.length === 0) return null
  // Only claim "by department" when department mosaics actually exist; otherwise this is the budget section.
  const hasDepartments = collections.some((c) => c.kind === "category")
  return (
    <div className="min-w-0 space-y-8">
      <FlashRail deals={flash} />
      <SelectionRail items={selection} />
      {collections.length > 0 ? (
        <section aria-labelledby="home-collections-heading" className="min-w-0">
          <div className="mb-4">
            <h2 id="home-collections-heading" className="text-2xl font-bold tracking-tight text-[color:var(--glass-text)]">
              {hasDepartments ? t("collectionsTitle") : t("budgetTitle")}
            </h2>
            <p className="mt-1 text-[15px] text-[color:var(--glass-muted)]">{hasDepartments ? t("collectionsSub") : t("budgetSub")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {collections.map((c) => (
              <CollectionCard key={c.key} collection={c} />
            ))}
          </div>
        </section>
      ) : null}
      <ShopsRail shops={shops} />
      <Directory groups={directory} />
    </div>
  )
}
