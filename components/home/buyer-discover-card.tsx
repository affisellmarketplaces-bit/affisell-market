import Link from "next/link"
import { useTranslations } from "next-intl"
import { Shield, Sparkles, Star, TrendingUp } from "lucide-react"

import { BuyerDiscoverTileImage } from "@/components/home/buyer-discover-tile-image"
import type { BuyerDiscoverCard as BuyerDiscoverCardModel } from "@/lib/buyer-premium-home-content"
import { BUYER_PREMIUM } from "@/lib/buyer-premium-home-tokens"
import { cn } from "@/lib/utils"

const ICONS = {
  trending: TrendingUp,
  sparkles: Sparkles,
  shield: Shield,
  stars: Star,
} as const

type Props = {
  card: BuyerDiscoverCardModel
  className?: string
}

export function BuyerDiscoverCard({ card, className }: Props) {
  const t = useTranslations("homeDiscover")
  const Icon = ICONS[card.icon]
  const images = Array.isArray(card.images) ? card.images.filter((img) => img?.src?.trim()) : []

  // Never leave pulse ghost tiles in the Discover rail — skip empty cards entirely.
  if (images.length === 0) return null

  return (
    <article
      className={cn(
        "group rounded-2xl p-5 transition hover:-translate-y-0.5 dark:bg-slate-950",
        className
      )}
      style={{
        backgroundColor: BUYER_PREMIUM.discover.cardBg,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: BUYER_PREMIUM.discover.cardBorder,
        boxShadow: BUYER_PREMIUM.discover.cardShadow,
      }}
    >
      <Link
        href={card.href}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition hover:opacity-90"
        style={{
          backgroundColor: BUYER_PREMIUM.badge.cardBg,
          color: BUYER_PREMIUM.badge.cardText,
        }}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {t(`title.${card.titleKey}`)}
      </Link>
      <div
        className="mt-4 grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, minmax(0, 1fr))`,
        }}
      >
        {images.slice(0, 3).map((img) => (
          <Link
            key={`${img.href}-${img.src}`}
            href={img.href}
            aria-label={img.alt || t(`title.${card.titleKey}`)}
            className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900"
          >
            <BuyerDiscoverTileImage src={img.src} label={img.alt || t(`title.${card.titleKey}`)} />
          </Link>
        ))}
      </div>
      <Link
        href={card.href}
        className="mt-4 block text-xs leading-relaxed transition hover:opacity-80 dark:text-slate-400"
        style={{ color: BUYER_PREMIUM.text.muted }}
      >
        {t(`subtitle.${card.subtitleKey}`, card.subtitleValues)}
      </Link>
    </article>
  )
}
