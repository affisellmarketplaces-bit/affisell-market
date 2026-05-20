"use client"

import useEmblaCarousel from "embla-carousel-react"
import { useEffect } from "react"
import { Store } from "lucide-react"

import { Link } from "@/i18n/navigation"
import type { PublicShopDirectoryEntry } from "@/lib/shop-storefront-data"

type Props = { shops: PublicShopDirectoryEntry[] }

export function FeaturedStoresCarousel({ shops }: Props) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true, align: "start" })

  useEffect(() => {
    if (shops.length < 2) return
    const id = setInterval(() => embla?.scrollNext(), 4000)
    return () => clearInterval(id)
  }, [embla, shops.length])

  if (shops.length === 0) {
    return <p className="text-xs text-zinc-500">—</p>
  }

  return (
    <div className="overflow-hidden" ref={emblaRef}>
      <ul className="flex gap-2">
        {shops.map((shop) => (
          <li key={shop.slug} className="min-w-[8.5rem] shrink-0">
            <Link
              href={`/shops/${shop.slug}`}
              className="flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5 text-xs dark:border-gray-800"
            >
              {shop.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logoUrl} alt="" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <Store className="h-5 w-5 text-[#6366F1]" aria-hidden />
              )}
              <span className="max-w-[5.5rem] truncate font-medium">{shop.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
