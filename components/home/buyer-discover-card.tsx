import { cn } from "@/lib/utils"
import Link from "next/link"
import Image from "next/image"

type DiscoverImage = { src: string; href: string; alt?: string }
type Props = {
  card: { title: string; href: string; icon?: any; images: DiscoverImage[] }
  className?: string
}

export function BuyerDiscoverCard({ card, className }: Props) {
  const Icon = card.icon
  const hasImages = card.images && card.images.length > 0
  const isValidIcon = Icon && (typeof Icon === 'function' || typeof Icon === 'object')

  return (
    <div className={cn("rounded- bg-white p-4 shadow-sm ring-1 ring-gray-100", className)}>
      <Link href={card.href} className="flex items-center gap-2 text- font-bold text-gray-900 hover:text-violet-600">
        {isValidIcon && <Icon className="size-3.5 shrink-0" aria-hidden />}
        <span>{card.title}</span>
      </Link>

      {hasImages? (
        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(card.images.length, 3)}, minmax(0, 1fr))` }}>
          {card.images.map((img, i) => (
            <Link key={`${img.href}-${i}`} href={img.href} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 group">
              <Image src={img.src} alt={img.alt || card.title} fill className="object-cover group-hover:scale-105 transition" sizes="200px" unoptimized />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[1,2,3].map(i => <div key={i} className="aspect-square rounded-xl bg-[#F3F6FD] animate-pulse" />)}
        </div>
      )}
    </div>
  )
}