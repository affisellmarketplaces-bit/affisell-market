"use client"

import Link from "next/link"

import type { CarouselItemJson } from "@/lib/carousel-types"

type Props = {
  a: CarouselItemJson
  b: CarouselItemJson
}

export function AffisellCarouselBundleCard({ a, b }: Props) {
  return (
    <div className="group/bundle flex h-full w-[min(100%,180px)] max-w-[calc((100vw-4.5rem)/2.5)] shrink-0 snap-start flex-col overflow-hidden rounded-md border-2 border-violet-200 bg-gradient-to-b from-violet-50 to-white shadow-sm sm:max-w-[180px] md:w-[180px]">
      <div className="px-2 pt-2">
        <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
          Value bundle
        </span>
        <p className="mt-1 line-clamp-2 text-xs font-semibold text-zinc-900">
          Best-selling duo - save more together
        </p>
      </div>
      <div className="mt-1 flex flex-1 justify-center gap-1 px-1">
        <div className="relative h-[84px] w-[84px] overflow-hidden rounded border border-zinc-200 bg-white">
          {a.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.imageUrl} alt="" className="h-full w-full object-contain" />
          ) : null}
        </div>
        <div className="relative h-[84px] w-[84px] overflow-hidden rounded border border-zinc-200 bg-white">
          {b.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.imageUrl} alt="" className="h-full w-full object-contain" />
          ) : null}
        </div>
      </div>
      <Link
        href={`/marketplace/${a.listingId}`}
        className="mx-2 mb-2 mt-auto rounded-full bg-violet-600 py-2 text-center text-xs font-semibold text-white transition hover:bg-violet-700"
      >
        View bundle
      </Link>
    </div>
  )
}
