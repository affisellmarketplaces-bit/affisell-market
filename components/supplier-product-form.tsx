"use client"

import Image from "next/image"
import type { FormEvent } from "react"
import { useEffect, useRef, useState } from "react"

import { ProductAttributesFields } from "@/components/product-attributes-fields"
import { variantsFromDb, type ProductVariantsJson } from "@/lib/product-variants"

export type SupplierProductRecord = {
  id: string
  name: string
  description: string
  images: string[]
  categories?: string[]
  colors?: string[]
  tags?: string[]
  variants?: unknown
  basePriceCents: number
  commissionRate: number
  stock: number
  active?: boolean
}

type FormState = {
  name: string
  description: string
  price: string
  commission: string
  stock: string
}

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    price: "",
    commission: "20",
    stock: "0",
  }
}

type Props = {
  /** When this id changes, form resets from `initial` */
  resetKey: string
  initial: SupplierProductRecord | null
  onSuccess: () => void
  submitLabelCreate?: string
  submitLabelEdit?: string
}

export function SupplierProductForm({
  resetKey,
  initial,
  onSuccess,
  submitLabelCreate = "Add Product",
  submitLabelEdit = "Save Changes",
}: Props) {
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [imageUrls, setImageUrls] = useState<string[]>([""])
  const [uploading, setUploading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [variants, setVariants] = useState<ProductVariantsJson | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!initial) {
      setForm(emptyForm())
      setImageUrls([""])
      setCategories([])
      setColors([])
      setTags([])
      setVariants(null)
      return
    }
    const imgs = (initial.images ?? []).map((u) => u.trim()).filter(Boolean)
    setImageUrls(imgs.length > 0 ? imgs : [""])
    setForm({
      name: initial.name,
      description: initial.description ?? "",
      price: (initial.basePriceCents / 100).toFixed(2),
      commission: String(initial.commissionRate),
      stock: String(typeof initial.stock === "number" ? initial.stock : 0),
    })
    setCategories(Array.isArray(initial.categories) ? initial.categories : [])
    setColors(Array.isArray(initial.colors) ? initial.colors : [])
    setTags(Array.isArray(initial.tags) ? initial.tags : [])
    setVariants(variantsFromDb(initial.variants))
  }, [resetKey, initial])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const images = imageUrls
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => !s.startsWith("blob:"))
        .slice(0, 10)
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        images,
        categories,
        colors,
        tags,
        variants: variants ?? undefined,
        price: Number(form.price),
        commission: Number(form.commission),
        stock: Number(form.stock),
      }

      if (!body.name) throw new Error("Name is required")
      if (!Number.isFinite(body.price) || body.price < 0) throw new Error("Invalid price")

      if (initial) {
        const res = await fetch(`/api/supplier/products/${initial.id}`, {
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

      imageUrls.forEach((u) => {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u)
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">{initial ? "Edit Product" : "Add Product"}</h2>
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

        <div className="md:col-span-2 space-y-3">
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Product Images (up to 10)
          </label>
          {imageUrls.map((url, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  const newUrls = [...imageUrls]
                  newUrls[index] = e.target.value
                  setImageUrls(newUrls)
                }}
                placeholder={`Image URL ${index + 1} (https://...)`}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
              {imageUrls.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    const next = imageUrls.filter((_, i) => i !== index)
                    setImageUrls(next.length ? next : [""])
                  }}
                  className="rounded-lg px-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {imageUrls.length < 10 ? (
            <button
              type="button"
              onClick={() => setImageUrls([...imageUrls, ""])}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              + Add another URL
            </button>
          ) : null}
          <div className="border-t border-zinc-200 pt-2 dark:border-zinc-700">
            <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
              Upload from your device for local preview only. Use HTTPS image URLs above to publish images to
              shoppers.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={uploading || busy}
              className="sr-only"
              aria-label="Choose image files"
              onChange={(e) => {
                const cap = Math.max(0, 10 - imageUrls.filter(Boolean).length)
                const files = Array.from(e.target.files || []).slice(0, cap)
                if (files.length === 0) return
                setUploading(true)
                try {
                  const urls = files.map((f) => URL.createObjectURL(f))
                  const merged = [...imageUrls.map((s) => s.trim()).filter(Boolean), ...urls].slice(0, 10)
                  setImageUrls(merged.length < 10 ? [...merged, ""] : merged)
                } finally {
                  setUploading(false)
                  e.target.value = ""
                }
              }}
            />
            <button
              type="button"
              disabled={uploading || busy}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Choose files
            </button>
          </div>
          {imageUrls.filter(Boolean).length > 0 ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {imageUrls.filter(Boolean).map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="relative aspect-square overflow-hidden rounded-lg bg-gray-50 dark:bg-zinc-800"
                >
                  <Image src={url} alt="" fill className="object-contain p-1" sizes="80px" unoptimized />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <textarea
          name="description"
          placeholder="Description"
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="md:col-span-2 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />

        <ProductAttributesFields
          categories={categories}
          onCategoriesChange={setCategories}
          colors={colors}
          onColorsChange={setColors}
          tags={tags}
          onTagsChange={setTags}
          variants={variants}
          onVariantsChange={setVariants}
        />

        <button
          type="submit"
          disabled={busy || uploading}
          className="md:col-span-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "Saving…" : initial ? submitLabelEdit : submitLabelCreate}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  )
}
