import type { ComponentType } from "react"
import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import {
  BadgeCheck,
  ChevronRight,
  Link2,
  Music2,
  Package,
  Radio,
  ShieldCheck,
  Truck,
} from "lucide-react"

import {
  SupplierStorefrontBrowse,
  type SupplierStorefrontListingSerializable,
} from "@/components/supplier/supplier-storefront-browse"
import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"
import { isCustomDomainHeaders } from "@/lib/storefront-request-headers"
import { primaryProductImage } from "@/lib/product-images"
import { formatVariantCommissionRange, variantSkuPricingSummary, variantsFromDb } from "@/lib/product-variants"
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
  if (!store) return { title: "Boutique · Affisell" }
  const desc =
    store.description?.trim().slice(0, 155) ??
    `${store.name} — boutique fournisseur sur Affisell. Parcourez le catalogue et achetez en toute confiance.`
  return {
    title: `${store.name} · Boutique fournisseur`,
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

  const hdrs = await headers()
  const isCustomDomain = isCustomDomainHeaders(hdrs)
  const theme = parseStorefrontTheme(store.storefrontTheme)
  const accent = theme.accent ?? "#7c3aed"
  const primary = theme.primary ?? "#18181b"

  const supplierId = store.userId
  const base = appBaseUrl()

  const products = await prisma.product.findMany({
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
      variants: true,
    },
  })

  const partnerListingGroups = await prisma.affiliateProduct.groupBy({
    by: ["productId"],
    where: { product: { supplierId }, isListed: true },
    _count: { _all: true },
  })

  const partnerListingCountByProductId = Object.fromEntries(
    partnerListingGroups.map((row) => [row.productId, row._count._all])
  )

  const fastShipCount = products.filter((p) => p.deliveryMax <= 3).length
  const minDelivery = products.reduce((m, p) => Math.min(m, p.deliveryMax), products[0]?.deliveryMax ?? 7)

  const listings: SupplierStorefrontListingSerializable[] = products.map((p) => {
    const compareNum = p.compareAt != null ? Number(p.compareAt) : null
    const skuPricing = variantSkuPricingSummary(variantsFromDb(p.variants), p.basePriceCents)
    return {
      id: p.id,
      name: p.name,
      basePriceCents: p.basePriceCents,
      commissionRate: skuPricing?.commissionMax ?? p.commissionRate,
      commissionDisplay: skuPricing
        ? formatVariantCommissionRange(skuPricing)
        : `${p.commissionRate}%`,
      variants: p.variants,
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
    push(Link2, store.twitter ? socialHref("twitter", store.twitter) : null, "X")
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

      <StorefrontThemeStyles theme={theme} />
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <header className="relative overflow-hidden border-b border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {store.bannerUrl ? (
            <div className="relative h-40 w-full sm:h-48 md:h-56">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={store.bannerUrl} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent dark:from-zinc-950 dark:via-zinc-950/50" />
            </div>
          ) : (
            <div
              className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
              style={{
                backgroundImage: `radial-gradient(ellipse 80% 60% at 10% -10%, color-mix(in srgb, ${accent} 35%, transparent), transparent 55%),
                radial-gradient(ellipse 60% 50% at 90% 0%, color-mix(in srgb, ${primary} 25%, transparent), transparent 50%)`,
              }}
              aria-hidden
            />
          )}

          <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
            {!isCustomDomain ? (
              <nav
                className="mb-6 flex flex-wrap items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400"
                aria-label="Fil d'Ariane"
              >
                <Link href="/" className="transition hover:text-zinc-900 dark:hover:text-white">
                  Accueil
                </Link>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                <Link
                  href={PUBLIC_MARKETPLACE_BROWSE_PATH}
                  className="transition hover:text-zinc-900 dark:hover:text-white"
                >
                  Marketplace
                </Link>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
                <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{store.name}</span>
              </nav>
            ) : (
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Boutique officielle</p>
            )}

            {store.isLive && store.liveUrl?.trim() ? (
              <a
                href={store.liveUrl.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <Radio className="h-3.5 w-3.5" aria-hidden />
                En direct{store.livePlatform ? ` · ${store.livePlatform}` : ""}
              </a>
            ) : null}

            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-start">
                {(store.aiAvatarUrl || store.logoUrl) && (
                  <div className="relative shrink-0">
                    <div
                      className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 opacity-80 blur-sm"
                      aria-hidden
                    />
                    <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      <Image
                        src={store.aiAvatarUrl || store.logoUrl || ""}
                        alt=""
                        width={88}
                        height={88}
                        className="h-[5.5rem] w-[5.5rem] object-cover"
                        unoptimized
                      />
                    </div>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-200">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Fournisseur vérifié Affisell
                  </p>
                  <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                    {store.name}
                  </h1>
                  <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-base">
                    {store.description?.trim() || "Catalogue officiel du fournisseur"}
                  </p>
                  {socials.length > 0 ? (
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {socials.map(({ href, label, Icon }) => (
                        <li key={label}>
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur transition hover:border-violet-300 hover:text-violet-800 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200"
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <div className="grid w-full shrink-0 grid-cols-3 gap-2 sm:max-w-md lg:max-w-sm">
                <div className="rounded-2xl border border-zinc-200/90 bg-white/90 p-3 text-center shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
                  <Package className="mx-auto h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
                  <p className="mt-2 text-xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {products.length}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Produits</p>
                </div>
                <div className="rounded-2xl border border-zinc-200/90 bg-white/90 p-3 text-center shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
                  <Truck className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <p className="mt-2 text-xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {fastShipCount > 0 ? fastShipCount : "—"}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Expédition rapide</p>
                </div>
                <div className="rounded-2xl border border-zinc-200/90 bg-white/90 p-3 text-center shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
                  <ShieldCheck className="mx-auto h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden />
                  <p className="mt-2 text-xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {minDelivery}j
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Délai max</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:pb-24">
          {products.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Catalogue bientôt disponible</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                Ce fournisseur n&apos;a pas encore publié de produits actifs.
              </p>
              <Link
                href={PUBLIC_MARKETPLACE_BROWSE_PATH}
                className="mt-8 inline-flex rounded-2xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-600/25 hover:bg-violet-700"
              >
                Explorer la marketplace
              </Link>
            </div>
          ) : (
              <SupplierStorefrontBrowse listings={listings} storeSlug={store.slug} />
          )}

          <aside className="mt-16 overflow-hidden rounded-3xl border border-zinc-200/90 bg-gradient-to-br from-zinc-900 via-violet-950 to-zinc-900 p-6 text-white shadow-xl dark:border-zinc-800 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-300">Affisell</p>
            <p className="mt-2 text-lg font-semibold">Vous êtes créateur ou fournisseur ?</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-300">
              Les acheteurs passent commande via les fiches produit Affisell. Les créateurs gèrent leurs listings depuis
              le hub affilié — pas depuis cette vitrine.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/signup/affiliate"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-violet-950 shadow hover:bg-violet-50"
              >
                Devenir créateur
              </Link>
              <Link
                href={PUBLIC_MARKETPLACE_BROWSE_PATH}
                className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
              >
                Marketplace acheteur
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
