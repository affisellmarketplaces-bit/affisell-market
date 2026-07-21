"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

import type { RadarImportJobProduct } from "@/lib/radar/radar-import-types"

/**
 * Additive prefill banner for `/dashboard/supplier/products/new?prefill=jobId`.
 * Does not modify supplier product forms — surfaces Radar ImportJob data above the wizard.
 */
export function RadarImportPrefillBanner() {
  const searchParams = useSearchParams()
  const jobId = searchParams.get("prefill")?.trim() ?? ""
  const [products, setProducts] = useState<RadarImportJobProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) {
      setProducts([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void fetch(`/api/radar/import-job/${encodeURIComponent(jobId)}`, {
      credentials: "same-origin",
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          products?: RadarImportJobProduct[]
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setError(data.error ?? "import_job_not_found")
          setProducts([])
          return
        }
        setProducts(Array.isArray(data.products) ? data.products : [])
      })
      .catch(() => {
        if (!cancelled) setError("fetch_failed")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [jobId])

  if (!jobId) return null

  return (
    <div className="border-b border-violet-200 bg-violet-50/90 px-4 py-3">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
          Import Radar · job {jobId.slice(0, 8)}…
        </p>
        {loading ? (
          <p className="mt-1 text-sm text-violet-900">Chargement des winners…</p>
        ) : error ? (
          <p className="mt-1 text-sm text-amber-800">Impossible de charger le job ({error}).</p>
        ) : products.length === 0 ? (
          <p className="mt-1 text-sm text-violet-900">Aucun produit dans ce job.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {products.slice(0, 6).map((p) => (
              <li
                key={p.winnerId}
                className="flex max-w-xs items-center gap-2 rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-xs text-zinc-800"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt="" className="size-8 rounded object-cover" />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded bg-zinc-100">📦</span>
                )}
                <span className="line-clamp-2 font-medium">{p.title}</span>
              </li>
            ))}
            {products.length > 6 ? (
              <li className="self-center text-xs text-violet-700">+{products.length - 6} autres</li>
            ) : null}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-violet-800">
          Données pré-remplies depuis World Radar — complétez le formulaire ci-dessous.
        </p>
      </div>
    </div>
  )
}
