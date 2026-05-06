"use client"

import { useState } from "react"
import useSWR from "swr"

import type { ChangeEvent, FormEvent } from "react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Cat = {
  id: string
  name: string
  icon: string
  subcategories: Array<{ id: string; name: string; slug: string; count?: number }>
}

export default function SupplierUploadPage() {
  const [form, setForm] = useState({ title: "", price: "", categoryId: "", stock: "0" })
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const { data, isLoading } = useSWR<{ categories: Cat[] }>("/api/categories", fetcher)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!file) {
      setError("Choisis une image.")
      return
    }

    const formData = new FormData()
    formData.append("image", file)
    formData.append("title", form.title)
    formData.append("price", form.price)
    formData.append("categoryId", form.categoryId)
    formData.append("stock", form.stock)

    setPending(true)
    try {
      const res = await fetch("/api/products/upload", {
        method: "POST",
        body: formData,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Échec de l’envoi")
        return
      }
      alert("Produit ajouté avec succès!")
      setForm({ title: "", price: "", categoryId: "", stock: "0" })
      setFile(null)
    } catch {
      setError("Erreur réseau")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-8 text-3xl font-bold">Ajouter un produit</h1>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Titre du produit"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded border p-3"
          required
        />
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="Prix (USD)"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="w-full rounded border p-3"
          required
        />
        <select
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          className="w-full rounded border p-3"
          required
          disabled={isLoading || !data?.categories?.length}
        >
          <option value="">Choisir une catégorie</option>
          {data?.categories?.map((cat) => (
            <optgroup key={cat.id} label={`${cat.icon} ${cat.name}`}>
              {cat.subcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          type="number"
          min="0"
          placeholder="Stock"
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: e.target.value })}
          className="w-full rounded border p-3"
          required
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
          className="w-full rounded border p-3"
          required
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-black py-3 font-bold text-white disabled:opacity-50"
        >
          {pending ? "Publication…" : "Publier le produit"}
        </button>
      </form>
    </div>
  )
}
