"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { shopListingPath } from "@/lib/affiliate-routes"
import type { ShopVariantAlternatives as Result } from "@/lib/restock-watch/shop-alternatives"

type Choice = { listingId: string; color: string | null; size: string | null; storage: string | null }

/**
 * Shop page only: the chosen variant is sold out → up to three products of THIS shop that have it in stock. A
 * suggestion the buyer is free to ignore; nothing is replaced. Renders nothing while the feature is off.
 */
export function ShopVariantAlternatives({ choice, storeSlug }: { choice: Choice; storeSlug: string }) {
  const t = useTranslations("boutique.variantAlternatives")
  const [data, setData] = useState<Result | null>(null)
  const q = new URLSearchParams({ listingId: choice.listingId })
  if (choice.color) q.set("color", choice.color)
  if (choice.size) q.set("size", choice.size)
  if (choice.storage) q.set("storage", choice.storage)
  const key = q.toString()

  useEffect(() => {
    let alive = true
    setData(null)
    fetch(`/api/store/variant-alternatives?${key}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Result | null) => {
        if (alive) setData(j)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [key])

  if (!data || data.mode !== "on" || data.status !== "found") return null
  return (
    <section className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800" aria-label={t("title", { variant: data.variantLabel })}>
      <p className="text-sm font-semibold">{t("title", { variant: data.variantLabel })}</p>
      <ul className="mt-2 space-y-2">
        {data.items.map((a) => (
          <li key={a.listingId}>
            <Link href={shopListingPath(storeSlug, a.listingId)} className="flex items-center gap-3 rounded-lg p-1 hover:bg-zinc-50 dark:hover:bg-zinc-900">
              {a.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- supplier photo URLs, same as the shop's cards
                <img src={a.imageUrl} alt="" className="h-12 w-12 rounded-md object-cover" loading="lazy" />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{a.name}</span>
                <span className="block text-xs text-zinc-500">{a.match === "identique" ? t("same") : t("similar")}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-zinc-500">{t("note")}</p>
    </section>
  )
}
