import Link from "next/link"

export type MarketplaceFilterParams = {
  shipsFrom?: string
  delivery?: string
  freeShipping?: string
}

function href(next: MarketplaceFilterParams): string {
  const sp = new URLSearchParams()
  if (next.shipsFrom) sp.set("shipsFrom", next.shipsFrom)
  if (next.delivery) sp.set("delivery", next.delivery)
  if (next.freeShipping) sp.set("freeShipping", next.freeShipping)
  const q = sp.toString()
  return q ? `/marketplace?${q}` : "/marketplace"
}

function chipClass(active: boolean) {
  return `inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium transition ${
    active
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-800"
  }`
}

export function MarketplaceFilterSidebar({ current }: { current: MarketplaceFilterParams }) {
  const c = current

  return (
    <aside className="w-full shrink-0 space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 lg:w-56">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ships from</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href={href({ ...c, shipsFrom: c.shipsFrom === "fr" ? undefined : "fr" })}
            className={chipClass(c.shipsFrom === "fr")}
          >
            France
          </Link>
          <Link
            href={href({ ...c, shipsFrom: c.shipsFrom === "eu" ? undefined : "eu" })}
            className={chipClass(c.shipsFrom === "eu")}
          >
            EU
          </Link>
          <Link
            href={href({ ...c, shipsFrom: c.shipsFrom === "worldwide" ? undefined : "worldwide" })}
            className={chipClass(c.shipsFrom === "worldwide")}
          >
            Worldwide
          </Link>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Delivery</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href={href({ ...c, delivery: c.delivery === "under3" ? undefined : "under3" })}
            className={chipClass(c.delivery === "under3")}
          >
            Under 3 days
          </Link>
          <Link
            href={href({ ...c, delivery: c.delivery === "under7" ? undefined : "under7" })}
            className={chipClass(c.delivery === "under7")}
          >
            Under 7 days
          </Link>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Offers</p>
        <Link
          href={href({ ...c, freeShipping: c.freeShipping === "1" ? undefined : "1" })}
          className={`mt-2 flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-medium ${
            c.freeShipping === "1"
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          }`}
        >
          {c.freeShipping === "1" ? "✓ Free shipping offers" : "Free shipping only"}
        </Link>
      </div>

      {(c.shipsFrom || c.delivery || c.freeShipping) && (
        <Link
          href="/marketplace"
          className="block text-center text-xs font-medium text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Clear all filters
        </Link>
      )}
    </aside>
  )
}
