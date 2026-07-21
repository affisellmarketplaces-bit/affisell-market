"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import useSWR from "swr"

import {
  formatRequestRelativeFr,
  PRODUCT_REQUEST_CATEGORIES,
  type ProductRequestDto,
} from "@/lib/product-request-types"

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "same-origin" })
  if (!res.ok) throw new Error(`fetch_${res.status}`)
  return res.json() as Promise<{ requests: ProductRequestDto[]; count: number }>
}

export function SupplierRequestsClient() {
  const [category, setCategory] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const url = category
    ? `/api/requests?status=open&category=${encodeURIComponent(category)}&limit=100`
    : `/api/requests?status=open&limit=100`

  const { data, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
  })

  const rows = data?.requests ?? []
  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId]
  )

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-zinc-900">Demandes resellers</h1>
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            Catégorie
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setSelectedId(null)
              }}
              className="rounded-lg border border-zinc-200 px-2 py-1.5 text-xs font-medium"
            >
              <option value="">Toutes</option>
              {PRODUCT_REQUEST_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading ? (
          <p className="text-sm text-zinc-500">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-600">
            Aucune demande ouverte.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedId === r.id
                      ? "border-orange-400 bg-orange-50 ring-1 ring-orange-300"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
                >
                  <p className="font-semibold text-zinc-900">{r.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {r.country} · {r.category} · {r.quantity} pcs ·{" "}
                    {formatRequestRelativeFr(r.createdAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
        {!selected ? (
          <p className="text-sm text-zinc-500">Sélectionne une demande pour voir les détails.</p>
        ) : (
          <div className="space-y-3">
            <h2 className="text-base font-bold text-zinc-900">{selected.title}</h2>
            {selected.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.imageUrl}
                alt=""
                className="h-32 w-full rounded-lg object-cover"
              />
            ) : null}
            <p className="text-xs text-zinc-600 whitespace-pre-wrap">
              {selected.description || "Pas de description."}
            </p>
            <dl className="space-y-1 text-xs text-zinc-700">
              <div className="flex justify-between gap-2">
                <dt>Pays</dt>
                <dd className="font-semibold">{selected.country}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Qté</dt>
                <dd className="font-semibold">{selected.quantity}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Prix cible</dt>
                <dd className="font-semibold">
                  {selected.targetPrice != null ? `${selected.targetPrice}€` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Email</dt>
                <dd className="truncate font-semibold">{selected.resellerEmail}</dd>
              </div>
            </dl>
            <a
              href={`mailto:${encodeURIComponent(selected.resellerEmail)}?subject=${encodeURIComponent(`Affisell — ${selected.title}`)}`}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#6D28D9] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5B21B6]"
            >
              Contacter
            </a>
            <Link
              href="/dashboard/supplier/products/new"
              className="block text-center text-xs font-semibold text-violet-700 hover:underline"
            >
              Créer le produit →
            </Link>
          </div>
        )}
      </aside>
    </div>
  )
}
