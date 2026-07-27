"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

/**
 * Shop PDP segment error boundary — keeps store chrome and offers retry
 * without blanking the whole Affisell shell.
 */
export default function ShopProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams()
  const slug = typeof params?.slug === "string" ? params.slug : null
  const shopHref = slug ? `/shops/${slug}` : "/shops"

  useEffect(() => {
    console.error("[shops/product error]", {
      message: error.message,
      digest: error.digest,
      slug,
    })
  }, [error, slug])

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">
        Something went wrong
      </p>
      <h1 className="mt-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
        This product page hit a snag
      </h1>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        You can retry, or go back to the shop catalog.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-zinc-400">Ref: {error.digest}</p>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
        >
          Try again
        </button>
        <Link
          href={shopHref}
          className="inline-flex items-center rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Back to shop
        </Link>
      </div>
    </div>
  )
}
