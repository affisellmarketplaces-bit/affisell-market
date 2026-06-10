"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

type TestResult = {
  ok: boolean
  status: number
  platform?: string
  method?: string
  warnings?: string[]
  error?: string
  product?: {
    title?: string
    price?: number
    currency?: string
    images?: string[]
    variants?: unknown[]
    brand?: string
    stock?: number
  }
  raw: unknown
}

const SAMPLE_URLS: Array<{ label: string; url: string }> = [
  { label: "1688", url: "https://detail.1688.com/offer/610947572360.html" },
  { label: "AliExpress", url: "https://www.aliexpress.com/item/1005006854172981.html" },
  { label: "Amazon", url: "https://www.amazon.fr/dp/B0CHX1W1XY" },
  { label: "Shein", url: "https://www.shein.com/-p-12345.html" },
]

export function AdminSupplyImportTester() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  async function runTest() {
    const u = url.trim()
    if (!u || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/supplier/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: u, options: { markup: 2.5 } }),
      })
      const data = (await res.json()) as Record<string, unknown>
      const products = Array.isArray(data.products) ? data.products : []
      const product = (products[0] ?? null) as TestResult["product"] | null
      setResult({
        ok: res.ok,
        status: res.status,
        platform: typeof data.platform === "string" ? data.platform : undefined,
        method: typeof data.method === "string" ? data.method : undefined,
        warnings: Array.isArray(data.warnings) ? (data.warnings as string[]) : undefined,
        error: typeof data.error === "string" ? data.error : undefined,
        product: product ?? undefined,
        raw: data,
      })
    } catch (error) {
      setResult({
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "Erreur réseau",
        raw: null,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        Testeur d’import URL
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Appelle <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">/api/supplier/import-url</code> avec
        votre session admin — même pipeline que les fournisseurs (1688 via OneBound, AliExpress,
        Amazon, Shopify, Shein, Temu, universel).
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runTest()
          }}
          placeholder="https://detail.1688.com/offer/….html"
          disabled={loading}
          className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-500/25 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={loading || !url.trim()}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {loading ? "Test…" : "Tester l’import"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {SAMPLE_URLS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setUrl(s.url)}
            className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-violet-300"
          >
            {s.label}
          </button>
        ))}
      </div>

      {result ? (
        <div
          className={
            result.ok
              ? "mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40"
              : "mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40"
          }
        >
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
            {result.ok ? "✓ Import OK" : `✗ Échec (HTTP ${result.status})`}
            {result.platform ? ` — ${result.platform}` : null}
            {result.method ? ` · ${result.method}` : null}
          </p>
          {result.error ? (
            <p className="mt-1 break-words text-red-700 dark:text-red-300">{result.error}</p>
          ) : null}
          {result.warnings?.length ? (
            <p className="mt-1 text-amber-700 dark:text-amber-300">{result.warnings.join(" ")}</p>
          ) : null}
          {result.product ? (
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
              <div>
                <dt className="inline font-medium">Titre : </dt>
                <dd className="inline">{result.product.title || "—"}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Prix : </dt>
                <dd className="inline">
                  {result.product.price ?? "—"} {result.product.currency ?? ""}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Images : </dt>
                <dd className="inline">{result.product.images?.length ?? 0}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Variantes : </dt>
                <dd className="inline">{result.product.variants?.length ?? 0}</dd>
              </div>
            </dl>
          ) : null}
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="mt-2 text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
          >
            {showRaw ? "Masquer le JSON brut" : "Voir le JSON brut"}
          </button>
          {showRaw ? (
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-200">
              {JSON.stringify(result.raw, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
