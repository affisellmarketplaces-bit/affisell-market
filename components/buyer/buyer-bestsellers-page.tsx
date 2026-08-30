import { getTranslations } from "next-intl/server"
import { ArrowLeft, ArrowUpRight, TrendingUp } from "lucide-react"

import { CatalogCardImage } from "@/components/home/catalog-card-image"
import { FastLink } from "@/components/navigation/fast-link"
import { PRODUCT_CARD_IMAGE_FALLBACK } from "@/lib/affiliate-listing-display"
import { buildBestSellerDeckCards } from "@/lib/home-best-seller-deck-shared"
import { BUYER_BESTSELLERS_PATH } from "@/lib/buyer-bestsellers-route"
import { loadHomeBestSellers7dSafe } from "@/lib/public-home-data"
import { cn } from "@/lib/utils"

const LIST_LIMIT = 24

function rankAccent(rank: number): string {
  if (rank === 1) return "from-amber-400/90 via-orange-500/80 to-fuchsia-600/70"
  if (rank <= 3) return "from-violet-400/80 via-indigo-500/70 to-sky-500/60"
  return "from-white/25 via-violet-500/30 to-indigo-600/40"
}

function rankRing(rank: number): string {
  if (rank === 1) return "ring-amber-300/50 shadow-[0_0_40px_rgba(251,191,36,0.35)]"
  if (rank <= 3) return "ring-violet-300/35 shadow-[0_0_28px_rgba(139,92,246,0.25)]"
  return "ring-white/15"
}

export async function BuyerBestsellersPage() {
  const t = await getTranslations("buyerBestsellers")
  const tSold = await getTranslations("home.buyerServices")
  const products = await loadHomeBestSellers7dSafe(LIST_LIMIT)
  const cards = buildBestSellerDeckCards(products, (count) =>
    tSold("bestSellersSold", { count })
  )

  console.log("[buyer-bestsellers]", {
    path: BUYER_BESTSELLERS_PATH,
    count: cards.length,
    result: cards.length > 0 ? "ok" : "empty",
  })

  return (
    <div className="relative min-h-[calc(100dvh-3.75rem)] overflow-x-clip bg-[#07060f] text-white">
      <div
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-violet-600/30 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 top-32 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-[110px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-[90px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-10">
        <FastLink
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-violet-100/90 backdrop-blur-md transition hover:border-white/25 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
          {t("backHome")}
        </FastLink>

        <header className="mt-8 text-center sm:mt-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300/90 sm:text-[11px]">
            {t("eyebrow")}
          </p>
          <div className="mx-auto mt-3 flex max-w-2xl flex-col items-center gap-3">
            <span
              className={cn(
                "inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-amber-400/90 via-violet-600/80 to-fuchsia-600/70 shadow-lg shadow-violet-900/40"
              )}
              aria-hidden
            >
              <TrendingUp className="size-6 text-white" />
            </span>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
              {t("title")}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-violet-100/80 sm:text-base">
              {t("subtitle")}
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-amber-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-100">
              {tSold("bestSellersBadge")}
              <span className="font-normal normal-case tracking-normal text-amber-100/80">
                · {t("liveWindow")}
              </span>
            </span>
          </div>
        </header>

        {cards.length === 0 ? (
          <div className="mx-auto mt-14 max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
            <p className="text-sm text-violet-100/85">{t("empty")}</p>
            <FastLink
              href="/#explorer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110"
            >
              {t("emptyCta")}
              <ArrowUpRight className="size-4" aria-hidden />
            </FastLink>
          </div>
        ) : (
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:gap-5">
            {cards.map((card, index) => {
              const href = `/marketplace/${encodeURIComponent(card.listingId)}`
              const isTop = card.rank <= 3
              return (
                <li
                  key={card.listingId}
                  className={cn(
                    "group flex",
                    index === 0 && "md:col-span-2 md:row-span-2"
                  )}
                >
                  <FastLink
                    href={href}
                    scroll
                    className={cn(
                      "affisell-inp-tap relative flex h-full w-full touch-manipulation flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-2 backdrop-blur-xl transition duration-300",
                      "hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]",
                      rankRing(card.rank),
                      index === 0 && "md:p-3"
                    )}
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-40 blur-2xl transition group-hover:opacity-60",
                        rankAccent(card.rank)
                      )}
                      aria-hidden
                    />
                    <div
                      className={cn(
                        "relative overflow-hidden rounded-[1rem] border border-white/10 bg-gradient-to-br from-violet-950/30 to-indigo-950/50",
                        index === 0 ? "aspect-[4/3] md:aspect-square" : "aspect-square"
                      )}
                    >
                      <CatalogCardImage
                        src={card.imageUrl?.trim() || PRODUCT_CARD_IMAGE_FALLBACK}
                        alt={card.name}
                        priority={index < 4}
                      />
                      <span
                        className={cn(
                          "absolute left-2 top-2 inline-flex min-w-[2rem] items-center justify-center rounded-lg border border-white/25 bg-gradient-to-br px-2 py-1 text-[11px] font-black leading-none text-white shadow-md",
                          isTop ? "from-amber-400 to-fuchsia-600" : "from-violet-600 to-indigo-700"
                        )}
                      >
                        {t("rank", { rank: card.rank })}
                      </span>
                    </div>
                    <div className="relative mt-2.5 flex min-h-0 flex-1 flex-col px-0.5 pb-0.5 sm:mt-3">
                      <h2
                        className={cn(
                          "line-clamp-2 font-bold leading-snug text-white",
                          index === 0 ? "text-sm sm:text-base md:text-lg" : "text-[12px] sm:text-sm"
                        )}
                      >
                        {card.name}
                      </h2>
                      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                        <div>
                          <p className="text-base font-black tracking-tight text-amber-100 sm:text-lg">
                            {card.priceLabel}
                          </p>
                          <p className="text-[10px] font-medium text-violet-200/75 sm:text-[11px]">
                            {card.soldLabel}
                          </p>
                        </div>
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition group-hover:border-white/30 group-hover:text-white">
                          <ArrowUpRight className="size-4" aria-hidden />
                        </span>
                      </div>
                    </div>
                  </FastLink>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
