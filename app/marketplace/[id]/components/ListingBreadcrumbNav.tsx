"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Fragment } from "react"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"

type Props = {
  homeLabel: string
  categories: string[]
}

export function ListingBreadcrumbNav({ homeLabel, categories }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="order-first col-span-full hidden flex-wrap items-center gap-1 border-b border-zinc-200/70 pb-2 text-[11px] text-zinc-500 sm:flex lg:pb-4 lg:text-xs dark:border-zinc-800/80 dark:text-zinc-400"
    >
      <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-200">
        {homeLabel}
      </Link>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
      <Link
        href={PUBLIC_MARKETPLACE_BROWSE_PATH}
        className="hover:text-zinc-900 dark:hover:text-zinc-200"
      >
        Marketplace
      </Link>
      {categories.slice(0, 2).map((c) => (
        <Fragment key={c}>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
          <span className="max-w-[12rem] truncate font-medium text-zinc-600 dark:text-zinc-300">{c}</span>
        </Fragment>
      ))}
    </nav>
  )
}
