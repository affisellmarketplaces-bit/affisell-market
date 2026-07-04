import Link from "next/link"
import { ExternalLink, ShieldCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { StorefrontProductCard } from "@/components/storefront/product-card"
import { StorefrontThemeStyles } from "@/components/storefront/storefront-theme-styles"
import type { ShopProductCard, ShopStoreSummary } from "@/lib/shop-storefront-shared"
import { storePathOnPlatform } from "@/lib/store-public-url"
import { cn } from "@/lib/utils"

type Props = {
  store: ShopStoreSummary
  products: ShopProductCard[]
}

/** Compact iframe-friendly shop widget — embeddable on blogs and link-in-bio pages. */
export async function StorefrontEmbedView({ store, products }: Props) {
  const t = await getTranslations("storefront.embedWidget")
  const widget = store.theme.embedWidget
  if (!widget?.enabled) return null

  const limit = widget.productLimit ?? 4
  const visible = products.slice(0, limit)
  const headline = widget.title?.trim() || t("defaultTitle", { name: store.name })
  const shopUrl = storePathOnPlatform({
    slug: store.slug,
    role: "AFFILIATE",
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-violet-50/40 px-3 py-4 dark:from-zinc-950 dark:via-zinc-950 dark:to-violet-950/30">
      <StorefrontThemeStyles theme={store.theme} />
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90">
          {store.logoUrl || store.aiAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.logoUrl ?? store.aiAvatarUrl ?? ""}
              alt=""
              className="size-11 rounded-xl object-cover"
            />
          ) : (
            <div
              className="flex size-11 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: store.theme.accent ?? "#7c3aed" }}
            >
              {store.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">{store.name}</p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{headline}</p>
          </div>
        </header>

        {visible.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5">
            {visible.map((product) => (
              <StorefrontProductCard
                key={product.listingId}
                product={product}
                storeSlug={store.slug}
                mode="customer"
                className="h-full"
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {t("emptyCatalog")}
          </p>
        )}

        <Link
          href={shopUrl}
          target="_top"
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm",
            "bg-violet-600 hover:bg-violet-700"
          )}
        >
          {t("shopCta", { name: store.name })}
          <ExternalLink className="size-4" aria-hidden />
        </Link>

        <p className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
          <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden />
          {t("poweredBy")}
        </p>
      </div>
    </div>
  )
}
