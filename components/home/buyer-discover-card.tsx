import Image from "next/image"
import Link from "next/link"
import { Shield, Sparkles, Star, TrendingUp } from "lucide-react"

import type { BuyerDiscoverCard } from "@/lib/buyer-premium-home-content"
import { cn } from "@/lib/utils"

const ICONS = {
  trending: TrendingUp,
  sparkles: Sparkles,
  shield: Shield,
  stars: Star,
} as const

type Props = {
  card: BuyerDiscoverCard
  className?: string
}

export function BuyerDiscoverCard({ card, className }: Props) {
  const Icon = ICONS[card.icon]

  return (
    <Link
      href={card.href}
      className={cn(
        "group block rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950",
        className
      )}
    >
      <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {card.title}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {card.images.map((img) => (
          <div
            key={img.src}
            className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900"
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width: 768px) 28vw, 140px"
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
            />
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{card.subtitle}</p>
    </Link>
  )
}
