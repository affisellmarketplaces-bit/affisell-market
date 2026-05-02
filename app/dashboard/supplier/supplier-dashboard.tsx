"use client"

import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type Product = {
  id: string
  name: string
  description: string
  image: string
  basePriceCents: number
  commissionRate: number
  stock: number
  active: boolean
}

type FormState = {
  name: string
  description: string
  price: string
  commission: string
  image: string
  stock: string
}

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    price: "",
    commission: "20",
    image: "",
    stock: "0",
  }
}

export function SupplierDashboard() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<Product | null>(null)

  async function load() {
    const res = await fetch("/api/supplier/products", {
      cache: "no-store",
      credentials: "include",
    })
    if (!res.ok) return
    const data = (await res.json()) as Product[]
    if (Array.isArray(data)) {
      setProducts(
        data.map((p) => ({
          ...p,
          stock: typeof p.stock === "number" ? p.stock : 0,
        }))
      )
    }
  }

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      try {
        const res = await fetch("/api/supplier/products", {
          cache: "no-store",
          credentials: "include",
          signal: ac.signal,
        })
        if (!res.ok || ac.signal.aborted) return
        const data = (await res.json()) as Product[]
        if (ac.signal.aborted || !Array.isArray(data)) return
        setProducts(
          data.map((p) => ({
            ...p,
            stock: typeof p.stock === "number" ? p.stock : 0,
          }))
        )
      } catch {
        /* aborted */
      }
    })()
    return () => ac.abort()
  }, [])

  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: (p.basePriceCents / 100).toFixed(2),
      commission: String(p.commissionRate),
      image: p.image ?? "",
      stock: String(typeof p.stock === "number" ? p.stock : 0),
    })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/supplier/products/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error ?? "Delete failed")
      }
      if (editing?.id === id) {
        setEditing(null)
        setForm(emptyForm())
      }
      await load()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        image: form.image.trim(),
        price: Number(form.price),
        commission: Number(form.commission),
        stock: Number(form.stock),
      }

      if (!body.name) throw new Error("Name is required")
      if (!Number.isFinite(body.price) || body.price < 0) throw new Error("Invalid price")

      if (editing) {
        const res = await fetch(`/api/supplier/products/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })
        const json = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(json.error ?? "Failed")
      } else {
        const res = await fetch("/api/supplier/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        })
        const json = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(json.error ?? "Failed")
      }

      await load()
      router.refresh()
      setEditing(null)
      setForm(emptyForm())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
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
        <h2>{editing ? "Edit Product" : "Add Product"}</h2>
        {form.image ? (
          <img
            src={form.image}
            alt=""
            className="mb-2 h-20 w-20 rounded object-cover"
            onError={(e) => {
              e.currentTarget.src = "/placeholder.png"
            }}
          />
        ) : null}
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            required
            name="name"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            required
            name="price"
            type="number"
            step="0.01"
            min="0"
            placeholder="Base price (EUR)"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="commission"
            type="number"
            min="1"
            max="99"
            placeholder="Commission % of margin"
            value={form.commission}
            onChange={(e) => setForm((f) => ({ ...f, commission: e.target.value }))}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="stock"
            type="number"
            min="0"
            step="1"
            placeholder="Stock"
            value={form.stock}
            onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            name="image"
            placeholder="Image URL"
            value={form.image}
            onChange={(e) => setForm((f) => ({ ...f, image: e.target.value.trim() }))}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <textarea
            name="description"
            placeholder="Description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="md:col-span-2 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={busy}
            className="md:col-span-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {editing ? "Save Changes" : "Add Product"}
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
              <article
                key={p.id}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-zinc-100">
                  <img
                    src={p.image || "/placeholder.png"}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.png"
                    }}
                  />
                </div>
                <div className="p-4">
                  <p className="font-semibold">{p.name}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{fmtEUR(p.basePriceCents)}</p>
                  <p className="mt-1 text-xs text-zinc-500">Commission on margin: {p.commissionRate}%</p>
                  <p className="mt-1 text-xs text-zinc-500">Stock: {p.stock}</p>
                  <p className="mt-2 text-xs">{p.active ? "Active" : "Inactive"}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleActive(p.id, p.active)}
                    className="mt-3 text-xs underline"
                  >
                    Toggle active
                  </button>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="px-3 py-1.5 text-sm border rounded-lg hover:bg-zinc-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="px-3 py-1.5 text-sm border rounded-lg text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
