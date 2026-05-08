"use client"

import { FormEvent, useEffect, useState } from "react"

const ALL_CATEGORIES = [
  "Clothing, Shoes & Jewelry", "Collectibles & Fine Art", "Computers", "Daily Deals",
  "Digital Music", "Electronics", "Garden & Outdoor", "Gift Cards", "Grocery & Gourmet Food",
  "Handmade", "Health & Household", "Home & Kitchen", "Industrial & Scientific",
  "Luggage & Travel Gear", "Luxury Stores", "Magazine Subscriptions", "Movies & TV",
  "Musical Instruments", "Office Products", "Pet Supplies", "Prime Video", "Smart Home",
  "Software", "Sports & Outdoors", "Tools & Home Improvement", "Toys & Games",
  "Vehicles", "Video Games",
]

export default function SupplierDashboardPage() {
  const [name, setName] = useState("")
  const [images, setImages] = useState<string[]>([""])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isCategorizing, setIsCategorizing] = useState(false)
  const [price, setPrice] = useState("")
  const [stock, setStock] = useState("0")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!name || name.length < 3) return
    const timer = setTimeout(async () => {
      setIsCategorizing(true)
      try {
        const res = await fetch("/api/categorize-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: name }),
        })
        const data = (await res.json()) as { categories?: string[] }
        const next = Array.isArray(data.categories) ? data.categories.slice(0, 3) : []
        if (next.length > 0) setSelectedCategories(next)
      } catch {
        // ignore suggestion errors
      } finally {
        setIsCategorizing(false)
      }
    }, 800)
    return () => clearTimeout(timer)
  }, [name])

  async function onImageUpload(firstImage: string) {
    if (!firstImage) return
    setIsCategorizing(true)
    try {
      const res = await fetch("/api/categorize-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name, imageUrl: firstImage }),
      })
      const data = (await res.json()) as { categories?: string[] }
      const next = Array.isArray(data.categories) ? data.categories.slice(0, 3) : []
      if (next.length > 0) setSelectedCategories(next)
    } catch {
      // ignore suggestion errors
    } finally {
      setIsCategorizing(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError("")
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        images: images.map((s) => s.trim()).filter(Boolean),
        categories: selectedCategories,
        price: Number(price),
        stock: Number(stock),
        commission: 15,
      }
      const res = await fetch("/api/supplier/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to create product")
      setName("")
      setImages([""])
      setSelectedCategories([])
      setPrice("")
      setStock("0")
      setDescription("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <h1 className="text-2xl font-bold">Supplier Dashboard · Add Product</h1>
      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="Product name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Product Images upload</label>
          {images.map((img, i) => (
            <input
              key={i}
              type="url"
              value={img}
              onChange={(e) => {
                const next = [...images]
                next[i] = e.target.value
                setImages(next)
                if (i === 0) void onImageUpload(e.target.value.trim())
              }}
              className="mt-1 w-full rounded-md border px-3 py-2"
              placeholder={`Image URL ${i + 1}`}
            />
          ))}
          {images.length < 5 ? (
            <button
              type="button"
              onClick={() => setImages([...images, ""])}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              + Add image
            </button>
          ) : null}
        </div>

        <div>
          <label>Categories (max 3) {isCategorizing && <span>AI analyzing...</span>}</label>
          <div className="grid grid-cols-3 gap-2">
            {ALL_CATEGORIES.map(cat => (
              <label key={cat}>
                <input 
                  type="checkbox" 
                  checked={selectedCategories.includes(cat)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedCategories(prev => [...prev, cat].slice(0,3))
                    else setSelectedCategories(prev => prev.filter(c => c!== cat))
                  }}
                /> {cat}
              </label>
            ))}
          </div>
          <p>Selected: {selectedCategories.length}/3</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Stock</label>
            <input
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="Describe your product"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {busy ? "Submitting..." : "Submit"}
        </button>
      </form>
    </main>
  )
}
