import Link from "next/link"

import { SmartFilters } from "@/components/marketplace/SmartFilters"
import messages from "@/messages/en.json"
import { AFFISELL_CATEGORIES } from "@/lib/affisell-categories"

export type MarketplaceFilterParams = {
  shipsFrom?: string
  delivery?: string
  freeShipping?: string
  category?: string
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  )
}

function href(next: MarketplaceFilterParams): string {
  const sp = new URLSearchParams()
  if (next.shipsFrom) sp.set("shipsFrom", next.shipsFrom)
  if (next.delivery) sp.set("delivery", next.delivery)
  if (next.freeShipping) sp.set("freeShipping", next.freeShipping)
  if (next.category && next.category !== "All Departments") sp.set("category", next.category)
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
  const t = messages.Filters

  return (
    <aside className="w-full shrink-0 space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 lg:w-56">
      <FilterGroup title={t.smartFilters}>
        <SmartFilters
          items={[
            {
              id: "trending",
              label: t.trendingNow,
              icon: "🔥",
              href: href({ ...c, delivery: c.delivery === "under3" ? undefined : "under3" }),
              active: c.delivery === "under3",
            },
            {
              id: "ships24h",
              label: t.ships24h,
              icon: "⚡",
              href: href({ ...c, shipsFrom: c.shipsFrom === "fr" ? undefined : "fr" }),
              active: c.shipsFrom === "fr",
            },
            {
              id: "under100",
              label: t.under100,
              icon: "💎",
              href: href({ ...c }),
              active: false,
            },
            {
              id: "topRated",
              label: t.topRated45,
              icon: "⭐",
              href: href({ ...c }),
              active: false,
            },
          ]}
        />
      </FilterGroup>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t.category}</p>
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
          {AFFISELL_CATEGORIES.map((cat) => {
            const isAll = cat === "All Departments"
            const active = isAll ? !c.category : c.category === cat
            return (
              <Link
                key={cat}
                href={
                  isAll
                    ? href({ ...c, category: undefined })
                    : href({ ...c, category: c.category === cat ? undefined : cat })
                }
                className={`block line-clamp-3 min-h-[2.25rem] break-words rounded-lg px-2 py-1 text-xs leading-snug transition ${
                  active
                    ? "bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
              {cat === "All Departments" ? t.allDepartments : cat}
              </Link>
            )
          })}
        </div>
      </div>

      <FilterGroup title="Style">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" className="accent-violet-600" />
          Minimalist
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" className="accent-violet-600" />
          Streetwear
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" className="accent-violet-600" />
          Business
        </label>
      </FilterGroup>

      <FilterGroup title="Price">
        <input type="range" min={0} max={500} defaultValue={250} className="w-full accent-violet-600" />
        <div className="flex justify-between text-xs text-zinc-500">
          <span>$0</span>
          <span>$500</span>
        </div>
      </FilterGroup>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ships from</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href={href({ ...c, shipsFrom: c.shipsFrom === "fr" ? undefined : "fr" })}
            className={`${chipClass(c.shipsFrom === "fr")} focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 active:scale-95`}
          >
            France
          </Link>
          <Link
            href={href({ ...c, shipsFrom: c.shipsFrom === "eu" ? undefined : "eu" })}
            className={`${chipClass(c.shipsFrom === "eu")} focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 active:scale-95`}
          >
            EU
          </Link>
          <Link
            href={href({ ...c, shipsFrom: c.shipsFrom === "worldwide" ? undefined : "worldwide" })}
            className={`${chipClass(c.shipsFrom === "worldwide")} focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 active:scale-95`}
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
            className={`${chipClass(c.delivery === "under3")} focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 active:scale-95`}
          >
            Under 3 days
          </Link>
          <Link
            href={href({ ...c, delivery: c.delivery === "under7" ? undefined : "under7" })}
            className={`${chipClass(c.delivery === "under7")} focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 active:scale-95`}
          >
            Under 7 days
          </Link>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Offers</p>
        <Link
          href={href({ ...c, freeShipping: c.freeShipping === "1" ? undefined : "1" })}
          className={`mt-2 flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 active:scale-95 ${
            c.freeShipping === "1"
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          }`}
        >
          {c.freeShipping === "1" ? "✓ Free shipping offers" : "Free shipping only"}
        </Link>
      </div>

      {(c.shipsFrom || c.delivery || c.freeShipping || c.category) && (
        <Link
          href="/shops/browse"
          className="block text-center text-xs font-medium text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Clear all filters
        </Link>
      )}
    </aside>
  )
}
