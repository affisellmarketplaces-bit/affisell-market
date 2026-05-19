"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

export type MerchandiseBlockItem = {
  image: string
  label: string
  href: string
}

export type MerchandiseBlockPayload = {
  title: string
  categoryId: string
  items: MerchandiseBlockItem[]
}

type Props = {
  /** Query value for `/api/merchandise/generate?category=` (e.g. `Sport`, `electronics`, `Home & Kitchen`). */
  category: string
  className?: string
}

export function CategoryBlock({ category, className }: Props) {
  const [data, setData] = useState<MerchandiseBlockPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({ category })
    void fetch(`/api/merchandise/generate?${qs.toString()}`)
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text()
          throw new Error(t || r.statusText)
        }
        return r.json() as Promise<MerchandiseBlockPayload>
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setError("unavailable")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [category])

  if (loading) {
    return (
      <section
        className={cn(
          "rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80",
          className
        )}
        aria-busy
        aria-label="Loading merchandising block"
      >
        <div className="h-6 w-2/3 max-w-sm animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-square animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (error || !data?.items?.length) {
    return null
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white/95 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80",
        className
      )}
    >
      <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-xl">{data.title}</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-5">
        {data.items.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="group block overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50/50 transition hover:border-violet-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-violet-900/50"
          >
            <div className="relative aspect-square overflow-hidden bg-white dark:bg-zinc-950">
              <Image
                src={item.image}
                alt=""
                fill
                className="object-cover transition group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 50vw, 25vw"
                unoptimized
              />
            </div>
            <p className="line-clamp-2 px-2 py-2 text-center text-xs font-medium text-zinc-800 dark:text-zinc-200">
              {item.label}
            </p>
          </Link>
        ))}
      </div>
      <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <Link
          href={`/shops/browse?category=${encodeURIComponent(data.categoryId)}`}
          className="text-sm font-semibold text-violet-600 underline-offset-4 hover:underline dark:text-violet-400"
        >
          See more
        </Link>
      </div>
    </section>
  )
}
