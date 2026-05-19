"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { ShoppingBag } from "lucide-react"

export function AffiliateBanner() {
  const { status } = useSession()

  if (status !== "unauthenticated") return null

  return (
    <div className="rounded-xl border border-sky-200/90 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
      <p className="flex flex-wrap items-center justify-center gap-2 text-center sm:justify-between">
        <span className="inline-flex items-center gap-2 font-medium">
          <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
          Acheteur ? Parcourez les boutiques créateurs.
        </span>
        <Link
          href="/shops"
          className="font-semibold text-sky-800 underline-offset-2 hover:underline dark:text-sky-200"
        >
          Voir les boutiques →
        </Link>
      </p>
    </div>
  )
}
