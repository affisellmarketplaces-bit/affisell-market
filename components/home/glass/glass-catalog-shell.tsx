"use client"

import { Heart, LayoutGrid, Star } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { CatalogCardImage } from "@/components/home/catalog-card-image"
import { CategoryGlyph } from "@/components/marketplace/CategoryGlyph"
import { FastLink } from "@/components/navigation/fast-link"
import { WishlistHeart } from "@/components/wishlist-heart"
import { catalogFilterHref } from "@/lib/marketplace-catalog-nav.client"
import { categoryRailHref } from "@/lib/marketplace-category-rail-href.client"
import { formatStoreCurrency } from "@/lib/market-config"
import { cn } from "@/lib/utils"

export type GlassCategory = { id: string; name: string; slug: string; icon?: string; fullPath?: string }
export type GlassProduct = {
  id: string
  productId: string
  title: string
  image: string
  fallbackImage: string | null
  href: string
  price: number
  rating: number
  reviews: number
}
export type GlassTrend = { id: string; name: string; image: string | null; href: string; sold: number }

type Props = {
  categories: GlassCategory[]
  products: GlassProduct[]
  catalogTotal: number
  trending: GlassTrend[]
}

const PRICE_MAX = 500
const PANEL =
  "rounded-3xl border border-white/60 bg-white/45 shadow-[0_10px_40px_-16px_rgba(76,29,149,0.28),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-150"

function scrollToExplorer() {
  window.setTimeout(() => document.getElementById("explorer")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
}

/* ── Left: categories ─────────────────────────────────────────────────────────────────────── */
function CategoriesPanel({ categories, activeId }: { categories: GlassCategory[]; activeId: string | null }) {
  const t = useTranslations("homeGlass")
  return (
    <aside className={cn(PANEL, "p-5 lg:sticky lg:top-24")} aria-label={t("categories")}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-[#14103a]">{t("categories")}</h2>
        <FastLink
          href={catalogFilterHref("/")}
          scroll={false}
          onClick={scrollToExplorer}
          aria-label={t("openCatalog")}
          title={t("allCatalog")}
          className="flex size-9 items-center justify-center rounded-xl text-[#3b2a8c] transition hover:bg-white/70"
        >
          <LayoutGrid className="size-5" aria-hidden />
        </FastLink>
      </div>
      <ul className="space-y-1">
        {categories.map((c) => {
          const active = activeId === c.id
          return (
            <li key={c.id}>
              <FastLink
                href={categoryRailHref("/", c)}
                scroll={false}
                onClick={scrollToExplorer}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-medium transition",
                  active ? "bg-[#D8CFF6] text-[#14103a] shadow-sm" : "text-[#14103a] hover:bg-white/60"
                )}
              >
                <CategoryGlyph name={c.name} slug={c.slug} icon={c.icon} fullPath={c.fullPath} size="lg" tone="bare" />
                <span className="truncate">{c.name}</span>
              </FastLink>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

/* ── Center: featured products ────────────────────────────────────────────────────────────── */
function Rating({ rating, reviews }: { rating: number; reviews: number }) {
  const t = useTranslations("homeGlass")
  if (reviews <= 0 || rating <= 0) return <p className="h-4" aria-hidden />
  return (
    <p className="flex items-center justify-center gap-1 text-xs text-zinc-600" aria-label={t("rating", { rating, count: reviews })}>
      <span className="tabular-nums">{rating.toFixed(1)}</span>
      <Star className="size-3 fill-current text-zinc-500" aria-hidden />
      <span className="tabular-nums">({reviews})</span>
    </p>
  )
}

function FeaturedGrid({ products, catalogTotal }: { products: GlassProduct[]; catalogTotal: number }) {
  const t = useTranslations("homeGlass")
  return (
    <section aria-labelledby="glass-featured-heading" className="min-w-0">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 id="glass-featured-heading" className="text-3xl font-bold tracking-tight text-[#14103a]">
            {t("featuredTitle")}
          </h2>
          <p className="mt-1 text-[15px] text-zinc-600">{t("results", { count: catalogTotal || products.length })}</p>
        </div>
        <FastLink
          href={catalogFilterHref("/")}
          scroll={false}
          onClick={scrollToExplorer}
          className="shrink-0 text-sm font-semibold text-[#4C2FB8] hover:underline"
        >
          {t("seeAll")}
        </FastLink>
      </div>
      <ul className="grid grid-cols-3 gap-4 2xl:grid-cols-4 2xl:[&>li:nth-child(n+9)]:hidden">
        {products.map((p, i) => (
          <li key={p.id} className="min-w-0">
            <div className="group relative flex h-full flex-col rounded-2xl bg-white p-3 shadow-[0_4px_18px_-8px_rgba(76,29,149,0.25)] ring-1 ring-white/70 transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-12px_rgba(76,29,149,0.35)]">
              <div className="absolute right-3.5 top-3.5 z-10">
                <WishlistHeart productId={p.productId} hideCount />
              </div>
              <FastLink href={p.href} prefetch className="flex flex-1 flex-col">
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#F6F4FC]">
                  <CatalogCardImage src={p.image} fallbackSrc={p.fallbackImage} alt={p.title} priority={i < 4} />
                </div>
                <h3 className="mt-3 line-clamp-2 min-h-[2.4rem] text-center text-[14px] font-semibold leading-snug text-[#14103a]">
                  {p.title}
                </h3>
                <p className="mt-1 text-center text-[17px] font-bold tracking-tight text-[#4C2FB8]">
                  {formatStoreCurrency(p.price)}
                </p>
                <Rating rating={p.rating} reviews={p.reviews} />
              </FastLink>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ── Right: filters & trending ────────────────────────────────────────────────────────────── */
function FiltersPanel({ trending }: { trending: GlassTrend[] }) {
  const t = useTranslations("homeGlass")
  const router = useRouter()
  const sp = useSearchParams()

  const initial = useMemo(() => {
    const raw = sp.get("price") ?? ""
    const range = /^(\d+)-(\d+)$/.exec(raw)
    if (range) return { lo: Math.min(+range[1], PRICE_MAX), hi: Math.min(+range[2], PRICE_MAX) }
    const under = /^under(\d+)$/.exec(raw)
    if (under) return { lo: 0, hi: Math.min(+under[1], PRICE_MAX) }
    const over = /^over(\d+)$/.exec(raw)
    if (over) return { lo: Math.min(+over[1], PRICE_MAX), hi: PRICE_MAX }
    return { lo: 0, hi: PRICE_MAX }
  }, [sp])

  const [lo, setLo] = useState(initial.lo)
  const [hi, setHi] = useState(initial.hi)
  const [freeShipping, setFreeShipping] = useState(sp.get("freeShipping") === "1")
  const [fresh, setFresh] = useState(sp.get("offer") === "new")

  const anyPrice = lo === 0 && hi === PRICE_MAX
  const priceValue = anyPrice ? null : hi === PRICE_MAX ? `over${lo}` : lo === 0 ? `under${hi}` : `${lo}-${hi}`

  function apply() {
    const params = new URLSearchParams(sp.toString())
    const set = (k: string, v: string | null) => (v ? params.set(k, v) : params.delete(k))
    set("price", priceValue)
    set("freeShipping", freeShipping ? "1" : null)
    set("offer", fresh ? "new" : null)
    router.push(catalogFilterHref("/", params.toString()), { scroll: false })
    scrollToExplorer()
  }

  function reset() {
    setLo(0)
    setHi(PRICE_MAX)
    setFreeShipping(false)
    setFresh(false)
    const params = new URLSearchParams(sp.toString())
    ;["price", "freeShipping", "offer"].forEach((k) => params.delete(k))
    router.push(catalogFilterHref("/", params.toString()), { scroll: false })
  }

  const pct = (v: number) => `${(v / PRICE_MAX) * 100}%`
  const label = (v: number) => formatStoreCurrency(v)

  return (
    <aside className={cn(PANEL, "p-5 lg:sticky lg:top-24")} aria-label={t("filtersTitle")}>
      <h2 className="text-xl font-bold tracking-tight text-[#14103a]">{t("filtersTitle")}</h2>

      <h3 className="mt-5 text-[15px] font-semibold text-[#14103a]">{t("priceRange")}</h3>
      <div className="relative mt-3 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-violet-200/80" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#7C5CE0]"
          style={{ left: pct(lo), right: `calc(100% - ${pct(hi)})` }}
        />
        <input
          type="range"
          min={0}
          max={PRICE_MAX}
          step={5}
          value={lo}
          aria-label={t("priceMin")}
          onChange={(e) => setLo(Math.min(Number(e.target.value), hi))}
          className="glass-dual-range absolute inset-0 w-full"
        />
        <input
          type="range"
          min={0}
          max={PRICE_MAX}
          step={5}
          value={hi}
          aria-label={t("priceMax")}
          onChange={(e) => setHi(Math.max(Number(e.target.value), lo))}
          className="glass-dual-range absolute inset-0 w-full"
        />
      </div>
      <div className="mt-1 flex justify-between text-sm tabular-nums text-zinc-700">
        <span>{label(0)}</span>
        <span>{label(PRICE_MAX)}</span>
      </div>
      <p className="mt-1 text-sm text-[#14103a]" role="status">
        {anyPrice ? t("anyPrice") : t("selected", { min: label(lo), max: label(hi) })}
      </p>

      <h3 className="mt-6 text-lg font-bold tracking-tight text-[#14103a]">{t("refine")}</h3>
      <div className="mt-2 space-y-2.5">
        {[
          { id: "free", text: t("freeShipping"), on: freeShipping, set: setFreeShipping },
          { id: "new", text: t("newArrivals"), on: fresh, set: setFresh },
        ].map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-3 text-[15px] text-[#14103a]">
            <input
              type="checkbox"
              checked={o.on}
              onChange={(e) => o.set(e.target.checked)}
              className="size-5 rounded-md border-zinc-400 accent-[#6D45E0]"
            />
            {o.text}
          </label>
        ))}
      </div>

      {trending.length > 0 ? (
        <>
          <hr className="my-5 border-white/70" />
          <h3 className="text-lg font-bold tracking-tight text-[#14103a]">{t("trendingTitle")}</h3>
          <ul className="mt-3 space-y-3">
            {trending.map((it, i) => (
              <li key={it.id}>
                <FastLink href={it.href} className="flex items-center gap-3 rounded-xl transition hover:bg-white/50">
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm">
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image} alt="" className="absolute inset-0 size-full object-contain" loading="lazy" />
                    ) : (
                      <Heart className="m-auto size-5 text-violet-300" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-[#14103a]">
                      {i === 0 ? t("topSold") : t("rankThisWeek", { rank: i + 1 })}
                    </span>
                    <span className="block truncate text-[13px] text-zinc-700">{it.name}</span>
                    <span className="block text-[11px] tabular-nums text-zinc-500">{t("soldThisWeek", { count: it.sold })}</span>
                  </span>
                </FastLink>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={apply}
          className="min-h-11 rounded-full bg-gradient-to-r from-[#7C4DF0] to-[#5B35D8] px-6 text-[15px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(91,53,216,0.7)] transition hover:brightness-110 active:scale-[0.98]"
        >
          {t("apply")}
        </button>
        <button type="button" onClick={reset} className="text-sm font-medium text-[#4C2FB8] hover:underline">
          {t("reset")}
        </button>
      </div>
    </aside>
  )
}

/** Desktop (lg+) glass catalog: Categories · Featured products · Filters & Trending. Mobile keeps its own chrome. */
export function GlassCatalogShell({ categories, products, catalogTotal, trending }: Props) {
  const sp = useSearchParams()
  const activeId = sp.get("category")
  if (products.length === 0 && categories.length === 0) return null

  return (
    <section className="hidden lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)_16.5rem] lg:items-start lg:gap-5 xl:grid-cols-[16rem_minmax(0,1fr)_17rem]">
      <CategoriesPanel categories={categories.slice(0, 9)} activeId={activeId} />
      <FeaturedGrid products={products} catalogTotal={catalogTotal} />
      <FiltersPanel trending={trending} />
    </section>
  )
}
