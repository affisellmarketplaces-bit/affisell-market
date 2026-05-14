import type { ComponentType } from "react"
import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ChevronRight, Link2, Music2, Radio, Users } from "lucide-react"

import {
  SupplierStorefrontBrowse,
  type SupplierStorefrontListingSerializable,
} from "@/components/supplier/supplier-storefront-browse"
import { primaryProductImage } from "@/lib/product-images"
import { formatStoreCount } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3001"
  ).replace(/\/$/, "")
}

function socialHref(kind: "instagram" | "tiktok" | "youtube" | "twitch" | "facebook" | "twitter", raw: string) {
  const v = raw.trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  const path = v.replace(/^@/, "")
  switch (kind) {
    case "instagram":
      return `https://instagram.com/${path}`
    case "tiktok":
      return `https://www.tiktok.com/@${path.replace(/^@/, "")}`
    case "youtube":
      return path.startsWith("channel/") || path.includes("/")
        ? `https://youtube.com/${path}`
        : `https://youtube.com/@${path}`
    case "twitch":
      return `https://twitch.tv/${path}`
    case "facebook":
      return `https://facebook.com/${path}`
    case "twitter":
      return `https://twitter.com/${path}`
    default:
      return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id: rawId } = await params
  const id = decodeURIComponent(rawId)
  const store = await prisma.store.findFirst({
    where: {
      slug: id,
      user: { role: "SUPPLIER" },
    },
    select: { name: true, description: true },
  })
  if (!store) return { title: "Store · Affisell" }
  const desc =
    store.description?.trim().slice(0, 155) ??
    `${store.name} — supplier storefront on Affisell. Browse products and shop with confidence.`
  return {
    title: `${store.name} · Supplier shop`,
    description: desc,
    openGraph: {
      title: store.name,
      description: desc,
      type: "website",
    },
  }
}

export default async function SupplierStorePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = decodeURIComponent(rawId)

  const store = await prisma.store.findFirst({
    where: {
      slug: id,
      user: { role: "SUPPLIER" },
    },
    include: { user: { select: { role: true } } },
  })

  if (!store || store.user.role !== "SUPPLIER") notFound()

  const supplierId = store.userId
  const base = appBaseUrl()
  const storePath = `/store/supplier/${encodeURIComponent(store.slug)}`

  const [products, affiliateGroups, clicksSum, partnerListingGroups] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId, active: true, isDraft: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        basePriceCents: true,
        commissionRate: true,
        listingKind: true,
        stock: true,
        images: true,
        compareAt: true,
        isOnSale: true,
        createdAt: true,
        tags: true,
        deliveryMax: true,
      },
    }),
    prisma.affiliateProduct.groupBy({
      by: ["affiliateId"],
      where: { product: { supplierId } },
    }),
    prisma.affiliateProduct.aggregate({
      where: { product: { supplierId } },
      _sum: { clicks: true },
    }),
    prisma.affiliateProduct.groupBy({
      by: ["productId"],
      where: { product: { supplierId }, isListed: true },
      _count: { _all: true },
    }),
  ])

  const partnerListingCountByProductId = Object.fromEntries(
    partnerListingGroups.map((row) => [row.productId, row._count._all])
  )

  const affiliateCount = affiliateGroups.length
  const viewHint = clicksSum._sum.clicks ?? 0
  const maxCommission = products.reduce((m, p) => Math.max(m, p.commissionRate), 0)

  const listings: SupplierStorefrontListingSerializable[] = products.map((p) => {
    const compareNum = p.compareAt != null ? Number(p.compareAt) : null
    return {
      id: p.id,
      name: p.name,
      basePriceCents: p.basePriceCents,
      commissionRate: p.commissionRate,
      listingKind: p.listingKind,
      stock: p.stock,
      imageUrl: primaryProductImage(p.images) || "/placeholder.png",
      compareAtNumber: compareNum != null && Number.isFinite(compareNum) ? compareNum : null,
      isOnSale: p.isOnSale,
      createdAtIso: p.createdAt.toISOString(),
      tags: p.tags ?? [],
      deliveryMax: p.deliveryMax,
      partnerListingCount: partnerListingCountByProductId[p.id] ?? 0,
    }
  })

  type SocIcon = ComponentType<{ className?: string }>
  const socials: { href: string; label: string; Icon: SocIcon }[] = []
  if (store.showSocialsOnStore) {
    const push = (Icon: SocIcon, href: string | null, label: string) => {
      if (href) socials.push({ href, label, Icon })
    }
    push(Link2, store.instagram ? socialHref("instagram", store.instagram) : null, "Instagram")
    push(Link2, store.youtube ? socialHref("youtube", store.youtube) : null, "YouTube")
    push(Music2, store.tiktok ? socialHref("tiktok", store.tiktok) : null, "TikTok")
    push(TwitchIcon, store.twitch ? socialHref("twitch", store.twitch) : null, "Twitch")
    push(Link2, store.facebook ? socialHref("facebook", store.facebook) : null, "Facebook")
    push(Link2, store.twitter ? socialHref("twitter", store.twitter) : null, "X / Twitter")
  }

  const jsonLd =
    products.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList" as const,
          name: store.name,
          numberOfItems: products.length,
          itemListElement: products.map((p, i) => ({
            "@type": "ListItem" as const,
            position: i + 1,
            url: `${base}/product/${p.id}`,
            name: p.name,
          })),
        }
      : null

  return (
    <>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}

      <div className="min-h-screen bg-gradient-to-b from-zinc-100 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
        {/* Hero */}
        <header className="relative overflow-hidden border-b border-zinc-200/80 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/80">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 20%, rgba(139,92,246,0.22), transparent 40%),
                radial-gradient(circle at 80% 0%, rgba(20,184,166,0.18), transparent 38%)`,
            }}
            aria-hidden
          />

          <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
            <nav className="mb-8 flex flex-wrap items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400" aria-label="Breadcrumb">
              <Link href="/" className="transition hover:text-zinc-900 dark:hover:text-white">
                Home
              </Link>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
              <Link href="/marketplace" className="transition hover:text-zinc-900 dark:hover:text-white">
                Marketplace
              </Link>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
              <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{store.name}</span>
            </nav>

            {store.isLive && store.liveUrl?.trim() ? (
              <a
                href={store.liveUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-100 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200 dark:hover:bg-red-950"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <Radio className="h-3.5 w-3.5" aria-hidden />
                Live now{store.livePlatform ? ` · ${store.livePlatform}` : ""}
              </a>
            ) : null}

            {store.bannerUrl ? (
              <div className="relative mb-8 aspect-[21/9] max-h-56 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-inner dark:border-zinc-700">
                <Image
                  src={store.bannerUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 1152px) 100vw, 1152px"
                  priority
                  unoptimized={store.bannerUrl.startsWith("http") || store.bannerUrl.startsWith("/uploads")}
                />
              </div>
            ) : (
              <div className="mb-8 hidden h-1 max-w-md rounded-full bg-gradient-to-r from-violet-500 via-teal-400 to-violet-500 sm:block lg:max-w-lg" aria-hidden />
            )}

            <div className="flex flex-wrap items-start gap-5 lg:gap-8">
              {store.aiAvatarUrl || store.logoUrl ? (
                <div className="shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <Image
                    src={store.aiAvatarUrl || store.logoUrl || ""}
                    alt=""
                    width={96}
                    height={96}
                    className="h-24 w-24 object-cover object-center p-0.5"
                    unoptimized
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-white md:text-4xl lg:text-5xl">
                  {store.name}
                </h1>
                {store.description ? (
                  <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {store.description}
                  </p>
                ) : (
                  <p className="mt-3 text-zinc-500 dark:text-zinc-400">Affiliate-friendly supplier on Affisell.</p>
                )}

                {socials.length > 0 ? (
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {socials.map(({ href, label, Icon }) => (
                      <li key={label}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm transition hover:border-violet-300 hover:text-violet-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-violet-700"
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200/90 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Partner offers
                </p>
                <p className="mt-2 text-2xl font-bold text-violet-700 dark:text-violet-300">
                  {maxCommission > 0 ? `Up to ${maxCommission}%` : "—"}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Margin shared with affiliates on listings below.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200/90 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  Active affiliates
                </p>
                <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{affiliateCount}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Creators currently promoting this catalog.</p>
              </div>
              <div className="rounded-2xl border border-zinc-200/90 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Catalog & reach</p>
                <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{products.length}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Live listings ·{" "}
                  {viewHint > 0 ? (
                    <>
                      <strong>{formatStoreCount(viewHint)}</strong> affiliate preview clicks tracked
                    </>
                  ) : (
                    "Promotion insights grow as affiliates share."
                  )}
                </p>
              </div>
            </div>

            <p className="mt-8 inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-teal-800 dark:text-teal-300">
              <span className="font-semibold">Affisell verified supplier</span>
              <span className="hidden text-zinc-400 sm:inline dark:text-zinc-600">·</span>
              <Link href={`/marketplace`} className="font-medium underline-offset-4 hover:underline">
                Back to marketplace
              </Link>
              <span className="hidden text-zinc-400 sm:inline dark:text-zinc-600">·</span>
              <span className="max-w-full break-all text-zinc-500 dark:text-zinc-400">
                Share: <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{base}{storePath}</span>
              </span>
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24">
          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Catalog coming soon</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                This supplier has not published active products yet. Explore the marketplace for other shops.
              </p>
              <Link
                href="/marketplace"
                className="mt-8 inline-flex rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Browse marketplace
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-10 rounded-2xl border border-zinc-200/90 bg-white/90 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 md:flex md:items-start md:gap-8 md:p-6">
                <div className="min-w-0 flex-1 space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  <p>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Shoppers: </span>
                    this page is the supplier showcase only. Use{" "}
                    <strong className="font-medium text-zinc-800 dark:text-zinc-200">View product</strong> to open the
                    official marketplace listing (cart, checkout, policies).
                  </p>
                  <p>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Affiliate partners: </span>
                    you do <strong className="font-medium text-zinc-800 dark:text-zinc-200">not</strong> add products
                    from this supplier URL. Listings and “Add to my store” live in your{" "}
                    <Link href="/dashboard/affiliate" className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-400">
                      affiliate hub
                    </Link>
                    —this catalog is read-only social proof with live commission labels.
                  </p>
                </div>
                <div className="mt-4 shrink-0 border-t border-zinc-100 pt-4 dark:border-zinc-800 md:mt-0 md:w-56 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Supplier tools
                  </p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Inventory, drafts, and publishing are managed in the supplier dashboard—not here.
                  </p>
                </div>
              </div>
              <SupplierStorefrontBrowse listings={listings} variant="supplier-showcase" />
            </>
          )}

          <aside className="mt-14 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-teal-50 p-6 dark:border-violet-900/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-teal-950/30 md:p-8">
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">Selling or promoting on Affisell?</p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              Suppliers control catalog and margins in the seller dashboard. Affiliates discover products in the marketplace and{" "}
              <strong className="font-semibold text-zinc-900 dark:text-white">attach them to their store from the affiliate hub</strong>
              —never from the supplier’s public showcase page.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-500"
              >
                Open a seller account
              </Link>
              <Link
                href="/dashboard/affiliate"
                className="rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-100 dark:hover:bg-violet-950/50"
              >
                Affiliate hub
              </Link>
              <Link href="/marketplace" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800">
                Browse marketplace
              </Link>
            </div>
          </aside>
        </main>
      </div>
    </>
  )
}

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M4.83 3H21v13.93l-5.55 5.07H11.9l-4.17 3.8V21.93H3V7.73L4.83 3zm12.93 13.93V9.53h-2.73v8.33h2.73zm-6.8 0V9.53H8.27v8.33h2.69z" />
    </svg>
  )
}
