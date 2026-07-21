"use client"

import Link from "next/link"
import useSWR from "swr"

import {
  formatRequestRelativeFr,
  type ProductRequestDto,
} from "@/lib/product-request-types"

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) throw new Error(`fetch_${res.status}`)
  return res.json() as Promise<{ requests: ProductRequestDto[]; count: number }>
}

/** Additive orange banner on supplier dashboard. */
export function SupplierProductRequestsTeaser() {
  const { data } = useSWR("/api/requests?status=open&limit=5", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const count = data?.count ?? 0
  const rows = data?.requests ?? []

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-orange-950">
          🔥 Demandes Resellers — {count} ouverte{count > 1 ? "s" : ""}
        </h3>
        <Link
          href="/dashboard/supplier/requests"
          className="text-xs font-semibold text-orange-800 hover:underline"
        >
          Voir toutes les demandes →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-orange-900/70">Aucune demande ouverte pour le moment.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="text-xs font-medium text-orange-950">
              {r.country} — {r.title} — {r.quantity}pcs — {formatRequestRelativeFr(r.createdAt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
