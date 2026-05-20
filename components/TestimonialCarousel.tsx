"use client"

import useEmblaCarousel from "embla-carousel-react"
import { Star } from "lucide-react"
import { useTranslations } from "next-intl"

type Item = { id: string; quoteKey: string; amount: string }

const ITEMS: Item[] = [
  { id: "1", quoteKey: "social.quote1", amount: "$2.4k" },
  { id: "2", quoteKey: "social.quote2", amount: "$1.8k" },
]

export function TestimonialCarousel() {
  const t = useTranslations("creators")
  const [emblaRef] = useEmblaCarousel({ loop: true, align: "center" })

  return (
    <div className="overflow-hidden" ref={emblaRef}>
      <ul className="flex">
        {ITEMS.map((item) => (
          <li key={item.id} className="min-w-full shrink-0 px-2">
            <blockquote className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-zinc-950">
              <div className="flex gap-0.5 text-amber-500" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                {t(item.quoteKey as "social.quote1")}
              </p>
              <p className="mt-3 text-xs font-semibold text-[#6366F1]">
                {t("social.revenueTag", { amount: item.amount })}
              </p>
            </blockquote>
          </li>
        ))}
      </ul>
    </div>
  )
}
