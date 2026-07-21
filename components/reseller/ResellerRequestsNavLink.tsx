"use client"

import Link from "next/link"
import useSWR from "swr"

import { cn } from "@/lib/utils"

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) return { count: 0 }
  return res.json() as Promise<{ count?: number }>
}

/** Nav pill "Demandes" with open-request badge. */
export function ResellerRequestsNavLink({
  active,
  className,
}: {
  active: boolean
  className?: string
}) {
  const { data } = useSWR("/api/requests?status=open&limit=1", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
  const count = data?.count ?? 0

  return (
    <Link
      href="/dashboard/reseller/requests"
      className={cn(
        "relative inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition",
        active
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
        className
      )}
      aria-current={active ? "page" : undefined}
    >
      Demandes
      {count > 0 ? (
        <span className="ml-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  )
}
