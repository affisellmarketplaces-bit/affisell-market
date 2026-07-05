import Link from "next/link"

import {
  formatTrackingAuditTimestamp,
  trackingAuditDeliveredAtSourceLabel,
  trackingAuditEventLabel,
  trackingAuditSourceLabel,
} from "@/lib/admin/orders/tracking-audit-labels.shared"
import type { AdminOrderTrackingAudit } from "@/lib/admin/orders/types"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Props = {
  audit: AdminOrderTrackingAudit
}

export function TrackingAuditPanel({ audit }: Props) {
  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Traçabilité colis</h2>
        <Link
          href={`/api/admin/orders/${audit.orderId}/tracking-audit`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          prefetch={false}
        >
          Exporter PDF (litige)
        </Link>
      </div>

      <Card>
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
          <CardTitle className="text-base">Instantané</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 pt-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-zinc-500">Suivi :</span>{" "}
            {audit.trackingNumber
              ? `${audit.trackingCarrier ?? "—"} · ${audit.trackingNumber}`
              : "—"}
          </p>
          <p>
            <span className="text-zinc-500">Verrouillé :</span>{" "}
            {audit.trackingLocked ? (
              <Badge variant="outline">Oui · {audit.trackingVerifiedBy ?? "validé"}</Badge>
            ) : (
              "Non"
            )}
          </p>
          <p>
            <span className="text-zinc-500">Livré (transporteur) :</span>{" "}
            {audit.deliveredAt
              ? `${formatTrackingAuditTimestamp(audit.deliveredAt)} · ${trackingAuditDeliveredAtSourceLabel(audit.deliveredAtSource)}`
              : "—"}
          </p>
          <p>
            <span className="text-zinc-500">Confirmé acheteur :</span>{" "}
            {audit.deliveryConfirmedAt
              ? formatTrackingAuditTimestamp(audit.deliveryConfirmedAt)
              : "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
          <CardTitle className="text-base">
            Journal ({audit.timeline.length} événement{audit.timeline.length === 1 ? "" : "s"})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {audit.timeline.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucun événement enregistré.</p>
          ) : (
            <ol className="space-y-3">
              {audit.timeline.map((event) => (
                <li
                  key={event.id}
                  className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="accent">{trackingAuditEventLabel(event.eventType)}</Badge>
                    <span className="text-xs text-zinc-500">
                      {formatTrackingAuditTimestamp(event.createdAt)} UTC
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                    Source : {trackingAuditSourceLabel(event.source)}
                    {event.trackingNumber
                      ? ` · ${event.trackingCarrier ?? "—"} ${event.trackingNumber}`
                      : null}
                    {event.verificationMethod ? ` · ${event.verificationMethod}` : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
