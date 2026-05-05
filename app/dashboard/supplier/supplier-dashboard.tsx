"use client"

import Image from "next/image"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { SupplierProductForm, type SupplierProductRecord } from "@/components/supplier-product-form"
import { primaryProductImage } from "@/lib/product-images"

export function SupplierDashboard() {
  const router = useRouter()
  const [products, setProducts] = useState<SupplierProductRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<SupplierProductRecord | null>(null)

  async function load() {
    const res = await fetch("/api/supplier/products", {
      cache: "no-store",
      credentials: "include",
    })
    if (!res.ok) return
    const data = (await res.json()) as SupplierProductRecord[]
    if (Array.isArray(data)) {
      setProducts(
        data.map((p) => ({
          ...p,
          images: Array.isArray(p.images) ? p.images : [],
          categories: Array.isArray(p.categories) ? p.categories : [],
          colors: Array.isArray(p.colors) ? p.colors : [],
          tags: Array.isArray(p.tags) ? p.tags : [],
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
        const data = (await res.json()) as SupplierProductRecord[]
        if (ac.signal.aborted || !Array.isArray(data)) return
        setProducts(
          data.map((p) => ({
            ...p,
            images: Array.isArray(p.images) ? p.images : [],
            categories: Array.isArray(p.categories) ? p.categories : [],
            colors: Array.isArray(p.colors) ? p.colors : [],
            tags: Array.isArray(p.tags) ? p.tags : [],
            stock: typeof p.stock === "number" ? p.stock : 0,
          }))
        )
      } catch {
        /* aborted */
      }
    })()
    return () => ac.abort()
  }, [])

  const openEdit = (p: SupplierProductRecord) => {
    setEditing(p)
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
      if (editing?.id === id) setEditing(null)
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

  async function handleFormSuccess() {
    await load()
    router.refresh()
    setEditing(null)
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Supplier · My products</h1>
          <Link
            href="/supplier/products/new"
            className="mt-1 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Open full-screen product wizard →
          </Link>
          <Link
            href="/seller/photo-studio"
            className="mt-2 block text-sm font-medium text-violet-700 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200"
          >
            Enhance Photos in Affisell Studio →
          </Link>
          <Link
            href="/dashboard/supplier/settings/store"
            className="mt-2 inline-block text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Store profile →
          </Link>
          <Link
            href="/dashboard/settings/social"
            className="mt-2 block text-sm font-medium text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
          >
            Social &amp; community hub →
          </Link>
          <Link
            href="/dashboard/settings/account"
            className="mt-2 block text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Account &amp; connected logins →
          </Link>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          Logout
        </button>
      </div>

      <SupplierProductForm
        resetKey={editing?.id ?? "new"}
        initial={editing}
        onSuccess={handleFormSuccess}
      />

      {error ? <p className="my-4 text-sm text-red-600">{error}</p> : null}

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
                <div className="relative aspect-square w-full overflow-hidden rounded-t-xl bg-gray-50 dark:bg-zinc-800">
                  <Image
                    src={primaryProductImage(p.images) || "/placeholder.png"}
                    alt={p.name}
                    fill
                    className="object-contain p-2"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    unoptimized={primaryProductImage(p.images).startsWith("http")}
                  />
                </div>
                <div className="p-4">
                  <p className="font-semibold">{p.name}</p>
                  {(p.categories?.length ?? 0) > 0 ? (
                    <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">
                      {(p.categories ?? []).slice(0, 3).join(" · ")}
                    </p>
                  ) : null}
                  {p.images.length > 1 ? (
                    <p className="mt-0.5 text-xs text-zinc-500">{p.images.length} images</p>
                  ) : null}
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{fmtEUR(p.basePriceCents)}</p>
                  <p className="mt-1 text-xs text-zinc-500">Commission on margin: {p.commissionRate}%</p>
                  <p className="mt-1 text-xs text-zinc-500">Stock: {p.stock}</p>
                  <p className="mt-2 text-xs">{p.active ? "Active" : "Inactive"}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleActive(p.id, Boolean(p.active))}
                    className="mt-3 text-xs underline"
                  >
                    Toggle active
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="rounded-lg border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900"
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
