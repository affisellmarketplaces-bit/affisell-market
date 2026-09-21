import Link from "next/link"
import { ArrowRight, ExternalLink, Package } from "lucide-react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { carrierTrackingUrl } from "@/lib/buyer-carrier-tracking"
import type { BuyerActiveOrder } from "@/lib/buyer-account-overview"

export type BuyerActiveOrdersLabels = {
  title: string
  viewAll: string
  details: string
  track: string
  ordered: (date: string) => string
  status: (status: string) => string
}

/** The latest orders still on their way: what the buyer opens the account to check. */
export function BuyerActiveOrders({
  orders,
  locale,
  labels,
}: {
  orders: BuyerActiveOrder[]
  locale: string
  labels: BuyerActiveOrdersLabels
}) {
  if (orders.length === 0) return null
  return (
    <BentoCard className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">{labels.title}</h2>
        <Link
          href="/marketplace/account/orders"
          className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
        >
          {labels.viewAll} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
        {orders.map((o) => {
          const trackUrl = carrierTrackingUrl(o.trackingCarrier, o.trackingNumber)
          return (
            <li key={o.id} className="flex items-center gap-3 py-3">
              <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                {o.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <Package className="size-6 text-zinc-400" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-white">{o.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                    {labels.status(o.status)}
                  </span>
                  <span>
                    {labels.ordered(
                      new Date(o.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short" })
                    )}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {trackUrl ? (
                    <a
                      href={trackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-violet-700 hover:underline dark:text-violet-300"
                    >
                      {labels.track} <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : null}
                  <Link
                    href={`/marketplace/account/orders/${o.id}`}
                    className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                  >
                    {labels.details}
                  </Link>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </BentoCard>
  )
}
