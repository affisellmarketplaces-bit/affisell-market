"use client"

import { useMemo, useState } from "react"

type PricingSuggestion = {
  id: string
  label: string
  price: number
  marginPct: number
  discountPct: number
}

function asMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function NewProductPage() {
  const [name, setName] = useState("")
  const [cost, setCost] = useState("10")
  const [price, setPrice] = useState("24.99")
  const [compareAt, setCompareAt] = useState("")
  const [stock, setStock] = useState("10")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<PricingSuggestion[]>([])

  const priceValue = Number(price)
  const compareAtValue = Number(compareAt)
  const costValue = Number(cost)

  const discountPct = useMemo(() => {
    if (!Number.isFinite(priceValue) || !Number.isFinite(compareAtValue) || compareAtValue <= priceValue) {
      return 0
    }
    return Math.round(((compareAtValue - priceValue) / compareAtValue) * 100)
  }, [compareAtValue, priceValue])

  const marginPct = useMemo(() => {
    if (!Number.isFinite(priceValue) || !Number.isFinite(costValue) || priceValue <= 0) {
      return 0
    }
    return Math.round(((priceValue - costValue) / priceValue) * 100)
  }, [costValue, priceValue])

  const validationError = useMemo(() => {
    if (!Number.isFinite(priceValue) || priceValue <= 0) return "Price must be greater than 0."
    if (compareAt.trim()) {
      if (!Number.isFinite(compareAtValue) || compareAtValue <= 0) return "Compare-at price is invalid."
      if (compareAtValue <= priceValue) return "Compare-at price must be greater than price."
      if (discountPct > 70) return "Discount cannot exceed 70%."
    }
    return null
  }, [compareAt, compareAtValue, discountPct, priceValue])

  async function getAiSuggestions() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cost: Number(cost),
          compareAt: compareAt.trim() ? Number(compareAt) : null,
        }),
      })
      const json = (await res.json()) as { suggestions?: PricingSuggestion[]; error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to get suggestions")
      }
      setSuggestions((json.suggestions ?? []).slice(0, 3))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get suggestions")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim() || "Untitled product",
        description: "",
        price: Number(price),
        compareAt: compareAt.trim() ? Number(compareAt) : null,
        commission: 15,
        stock: Number(stock) || 0,
        images: [],
      }
      const res = await fetch("/api/supplier/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as { id?: string; error?: string }
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to create product")
      }
      setSuccess("Product created with pricing and compare-at values.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">New Product Pricing</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Set selling price, compare-at price, and validate margin before publishing.
      </p>

      <form onSubmit={handleCreate} className="mt-6 space-y-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Product Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wireless Earbuds Pro"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cost Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Stock</label>
            <input
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Compare At Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={compareAt}
              onChange={(e) => setCompareAt(e.target.value)}
              placeholder="29.99"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
        </div>

        <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">Live Preview</h2>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {Number.isFinite(priceValue) ? asMoney(priceValue) : "--"}
            </span>
            {Number.isFinite(compareAtValue) && compareAtValue > priceValue ? (
              <span className="text-sm text-zinc-500 line-through dark:text-zinc-400">{asMoney(compareAtValue)}</span>
            ) : null}
            {discountPct > 0 ? (
              <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">SAVE {discountPct}%</span>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
            Margin Calculator
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Estimated margin: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{marginPct}%</span>
          </p>
          {marginPct < 15 ? (
            <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Warning: margin is below 15%.
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
              AI Price Suggestion
            </h2>
            <button
              type="button"
              onClick={getAiSuggestions}
              disabled={loading}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              {loading ? "Thinking..." : "Generate"}
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setPrice(s.price.toFixed(2))}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
              >
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{s.label}</p>
                <p className="text-zinc-700 dark:text-zinc-300">{asMoney(s.price)}</p>
                <p className="text-xs text-zinc-500">Margin {s.marginPct}%</p>
              </button>
            ))}
            {suggestions.length === 0 ? (
              <div className="sm:col-span-3 text-sm text-zinc-500">Click Generate to get 3 AI pricing options.</div>
            ) : null}
          </div>
        </section>

        {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

        <button
          type="submit"
          disabled={saving || Boolean(validationError)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? "Creating..." : "Create Product"}
        </button>
      </form>
    </main>
  )
}
