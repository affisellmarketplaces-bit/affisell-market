"use client"

import { ExternalLink, Package, Truck } from "lucide-react"
import Link from "next/link"

import { BentoCard } from "@/components/affisell/bento-ui"
import { cn } from "@/lib/utils"

import type { UnifiedTrackingParcel } from "@/lib/fulfillment/unified-tracking-types"

type Props = {
  parcels: UnifiedTrackingParcel[]
  currentOrderId: string
  parcelCount: number
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Processing",
  AUTO_BUYING: "Ordering from supplier",
  AWAITING_SHIPMENT: "Preparing shipment",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  FAILED: "Issue — support notified",
  CANCELLED: "Cancelled",
}

export function UnifiedTrackingTimeline({ parcels, currentOrderId, parcelCount }: Props) {
  if (parcels.length === 0) return null

  return (
    <BentoCard className="space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">Delivery tracking</h2>
        {parcelCount > 1 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Your checkout was split into {parcelCount} parcels — each ships independently (Amazon-style).
          </p>
        ) : null}
      </div>

      <ol className="space-y-4">
        {parcels.map((parcel) => {
          const isCurrent = parcel.items.some((i) => i.orderId === currentOrderId)
          const label = STATUS_LABEL[parcel.status] ?? parcel.status

          return (
            <li
              key={parcel.id}
              className={cn(
                "rounded-xl border p-4",
                isCurrent
                  ? "border-violet-300 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20"
                  : "border-border"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Parcel {parcel.index}/{parcelCount}
                    {parcel.provider ? ` · ${parcel.provider}` : ""}
                  </p>
                  <p className="mt-1 font-medium">
                    {parcel.items.map((i) => i.productName).join(", ")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{label}</p>
                </div>
                {parcel.trackingNumber ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                    <Truck className="size-3.5" aria-hidden />
                    Shipped
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    <Package className="size-3.5" aria-hidden />
                    Preparing
                  </span>
                )}
              </div>

              {parcel.trackingNumber ? (
                <div className="mt-3 text-sm">
                  <p>
                    {parcel.trackingCarrier} · <span className="font-mono">{parcel.trackingNumber}</span>
                  </p>
                  {parcel.trackingUrl ? (
                    <Link
                      href={parcel.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-violet-600 hover:underline dark:text-violet-400"
                    >
                      Track parcel
                      <ExternalLink className="size-3.5" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {parcel.error ? (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{parcel.error}</p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </BentoCard>
  )
}
