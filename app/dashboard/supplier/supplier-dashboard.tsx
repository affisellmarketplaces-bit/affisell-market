"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type Row = {
  id: string
  name: string
  description: string
  image: string
  basePriceCents: number
  commissionRate: number
  active: boolean
}

export function SupplierDashboard() {
  const router = useRouter()
  const [products, setProducts] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ image: "" })

  async function load() {
    const res = await fetch("/api/supplier/products", {
      cache: "no-store",
      credentials: "include",
    })
    if (!res.ok) return
    const data = (await res.json()) as Row[]
    if (Array.isArray(data)) setProducts(data)
  }

  useEffect(() => {
    void load()
  }, [])

  async function createProduct(formData: FormData) {
    setBusy(true)
    setError(null)
    try {
      const basePrice = Number(formData.get("basePrice"))
      const data = {
        name: String(formData.get("name") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        basePriceCents: Math.round(basePrice * 100),
        commissionRate: Number(formData.get("commissionRate") ?? 20),
        image: String(formData.get("image") ?? "").trim(),
      }
      const res = await fetch("/api/supplier/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed")
      await load()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed")
      await load()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  function fmtEUR(cents: number) {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "EUR" })
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <h1 className="text-2xl font-semibold">Supplier · My products</h1>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-medium">Add product</h2>
        {form.image && (
          <img
            src={form.image}
            alt=""
            className="h-20 w-20 object-cover rounded mb-2"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.png"
            }}
          />
        )}
        <form action={createProduct} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            required
            name="name"
            placeholder="Name"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            required
            name="basePrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="Base price (EUR)"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="commissionRate"
            type="number"
            min="1"
            max="99"
            placeholder="Commission % of margin"
            defaultValue={20}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="image"
            placeholder="Image URL"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            onChange={(e) => setForm((f) => ({ ...f, image: e.target.value.trim() }))}
          />
          <textarea
            name="description"
            placeholder="Description"
            rows={3}
            className="md:col-span-2 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={busy}
            className="md:col-span-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add product
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">Your catalog</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.length === 0 ? (
            <p className="col-span-full text-zinc-500">No products yet.</p>
          ) : (
            products.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <img
                    src={p.image || "/placeholder.png"}
                    alt={p.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.png"
                    }}
                  />
                </div>
                <div className="p-4">
                  <p className="font-semibold">{p.name}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{fmtEUR(p.basePriceCents)}</p>
                  <p className="mt-1 text-xs text-zinc-500">Commission on margin: {p.commissionRate}%</p>
                  <p className="mt-2 text-xs">{p.active ? "Active" : "Inactive"}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleActive(p.id, p.active)}
                    className="mt-3 text-xs underline"
                  >
                    Toggle active
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
