'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ProductSpecsTable from '@/components/supplier/ProductSpecsTable'

type TreeCategory = {
  id: string
  name: string
  slug: string
  subcategories?: Array<{ id: string; name: string; slug: string }>
}

type LookupPayload = {
  found?: boolean
  product?: {
    title?: string
    name?: string
    brand?: string
    gtin?: string
    price?: number
    salePrice?: number
    quantity?: number
    categoryId?: string
    specs?: Record<string, string>
    images?: string[]
  }
}

const STEPS = [
  'Find Product',
  'Vital Info',
  'Offer',
  'Details',
  'Images',
]

function isValidEAN13(value: string): boolean {
  const v = value.replace(/\D/g, '')
  if (v.length !== 13) return false
  const digits = v.split('').map(Number)
  const check = digits[12]
  const sum = digits
    .slice(0, 12)
    .reduce((acc, d, idx) => acc + d * (idx % 2 === 0 ? 1 : 3), 0)
  const calc = (10 - (sum % 10)) % 10
  return calc === check
}

export default function AddSupplierProductPage() {
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState(1)
  const [productTitle, setProductTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('')
  const [gtin, setGtin] = useState('')
  const [price, setPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [specs, setSpecs] = useState<Record<string, string>>({})
  const [images, setImages] = useState<string[]>([])

  const [condition, setCondition] = useState('new')
  const [fulfillment, setFulfillment] = useState('supplier')
  const [mainImage, setMainImage] = useState(0)

  const [categories, setCategories] = useState<TreeCategory[]>([])
  const [categorySearch, setCategorySearch] = useState('')
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])

  const [lookupLoading, setLookupLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/categories/tree')
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data?.categories) ? data.categories : []))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    const q = brand.trim()
    if (q.length < 2) {
      setBrandSuggestions([])
      return
    }
    const t = setTimeout(() => {
      fetch(`/api/brands/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          const list = Array.isArray(data?.brands) ? data.brands : []
          setBrandSuggestions(list.map((x: unknown) => String(x)))
        })
        .catch(() => setBrandSuggestions([]))
    }, 250)
    return () => clearTimeout(t)
  }, [brand])

  const categoryOptions = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    return categories.map((c) => ({
      ...c,
      subcategories: (c.subcategories ?? []).filter((s) => {
        if (!q) return true
        return (
          c.name.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q)
        )
      }),
    }))
  }, [categories, categorySearch])

  async function handleFindProduct() {
    if (!productTitle.trim()) return
    setLookupLoading(true)
    try {
      const res = await fetch('/api/products/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: productTitle.trim() }),
      })
      const data = (await res.json()) as LookupPayload
      if (data?.found && data.product) {
        const p = data.product
        setProductTitle(String(p.title ?? p.name ?? productTitle))
        setBrand(String(p.brand ?? ''))
        setGtin(String(p.gtin ?? ''))
        setPrice(p.price != null ? String(p.price) : '')
        setSalePrice(p.salePrice != null ? String(p.salePrice) : '')
        setQuantity(p.quantity != null ? String(p.quantity) : quantity)
        setCategoryId(String(p.categoryId ?? ''))
        setSpecs((p.specs as Record<string, string>) ?? {})
        setImages(Array.isArray(p.images) ? p.images : [])
        setCurrentStep(3)
      } else {
        setCurrentStep(2)
      }
    } finally {
      setLookupLoading(false)
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    const uploaded: string[] = []

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      const up = await fetch('/api/upload-temp', { method: 'POST', body: formData })
      const payload = await up.json()
      if (up.ok && payload?.url) uploaded.push(String(payload.url))
    }

    if (uploaded.length > 0) {
      setImages((prev) => [...prev, ...uploaded])

      // AI extract from first uploaded image to suggest extra specs
      try {
        const ai = await fetch('/api/ai/extract-specs-from-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: productTitle,
            categoryId,
            imageUrl: uploaded[0],
          }),
        })
        const data = await ai.json()
        if (data?.suggestions && typeof data.suggestions === 'object') {
          setSpecs((prev) => ({ ...prev, ...(data.suggestions as Record<string, string>) }))
        }
      } catch {
        // non-blocking
      }
    }
  }

  async function handleSubmit() {
    if (!productTitle.trim() || !categoryId || !price) return
    if (gtin && !isValidEAN13(gtin)) {
      alert('GTIN must be a valid EAN-13 code')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: productTitle,
        title: productTitle,
        categoryId,
        brand,
        gtin,
        price: Number(price),
        salePrice: salePrice ? Number(salePrice) : null,
        stock: Number(quantity || '0'),
        condition,
        fulfillment,
        specs,
        images,
        image: images[mainImage] ?? images[0] ?? '',
        productAttributes: Object.entries(specs)
          .filter(([, v]) => String(v ?? '').trim().length > 0)
          .map(([key, value]) => ({ key, label: key, value: String(value) })),
      }

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to save product')

      alert('Product saved successfully')
      router.push('/dashboard/supplier/products')
    } catch {
      alert('Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Add Product</h1>
      <p className="mt-1 text-sm text-zinc-500">Structured product creation workflow for suppliers.</p>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {STEPS.map((label, idx) => {
            const n = idx + 1
            const active = currentStep === n
            const done = currentStep > n
            return (
              <button
                key={label}
                type="button"
                onClick={() => setCurrentStep(n)}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  active
                    ? 'border-black bg-black text-white'
                    : done
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                }`}
              >
                <div className="text-xs font-semibold">Step {n}</div>
                <div className="font-medium">{label}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-6">
        {currentStep === 1 ? (
          <div className="space-y-3">
            <label className="text-sm font-medium">Product title</label>
            <Input
              value={productTitle}
              onChange={(e) => setProductTitle(e.target.value)}
              placeholder="e.g. iPhone 15 Pro Max 256GB Natural Titanium"
            />
            <Button onClick={handleFindProduct} disabled={lookupLoading || !productTitle.trim()}>
              {lookupLoading ? 'Searching…' : 'Find Product'}
            </Button>
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Search subcategory</label>
              <Input
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search across categories"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Subcategory</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Select subcategory</option>
                {categoryOptions.flatMap((c) =>
                  (c.subcategories ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {c.name} → {s.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Brand</label>
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                list="brand-suggestions"
                placeholder="Brand"
              />
              <datalist id="brand-suggestions">
                {brandSuggestions.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-sm font-medium">GTIN (EAN-13)</label>
              <Input value={gtin} onChange={(e) => setGtin(e.target.value)} placeholder="13-digit code" />
              {gtin && !isValidEAN13(gtin) ? (
                <p className="mt-1 text-xs text-red-600">Invalid EAN-13 checksum</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {currentStep === 3 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Price</label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Sale Price</label>
              <Input type="number" step="0.01" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
                <option value="new">New</option>
                <option value="used_like_new">Used - Like New</option>
                <option value="used_good">Used - Good</option>
                <option value="refurbished">Refurbished</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Fulfillment</label>
              <div className="mt-2 flex gap-6 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={fulfillment === 'supplier'} onChange={() => setFulfillment('supplier')} />
                  Supplier fulfilled
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" checked={fulfillment === 'platform'} onChange={() => setFulfillment('platform')} />
                  Platform fulfilled
                </label>
              </div>
            </div>
          </div>
        ) : null}

        {currentStep === 4 ? (
          <ProductSpecsTable
            categoryId={categoryId}
            productTitle={productTitle}
            images={images}
            onSpecsChange={setSpecs}
          />
        ) : null}

        {currentStep === 5 ? (
          <div className="space-y-4">
            <div
              className="rounded-lg border-2 border-dashed border-zinc-300 p-6 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                uploadFiles(e.dataTransfer.files)
              }}
            >
              <p className="text-sm text-zinc-600">Drag & drop images here, or use file picker</p>
              <div className="mt-3">
                <input type="file" accept="image/*" multiple onChange={(e) => uploadFiles(e.target.files)} />
              </div>
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {images.map((src, idx) => (
                  <button
                    key={`${src}-${idx}`}
                    type="button"
                    onClick={() => setMainImage(idx)}
                    className={`overflow-hidden rounded-lg border ${mainImage === idx ? 'border-violet-600 ring-2 ring-violet-200' : 'border-zinc-200'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`uploaded-${idx}`} className="h-32 w-full object-cover" />
                    <div className="px-2 py-1 text-xs">{mainImage === idx ? 'Main image' : 'Set as main'}</div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="outline" onClick={() => setCurrentStep((s) => Math.max(1, s - 1))} disabled={currentStep === 1}>
            Back
          </Button>
          {currentStep < 5 ? (
            <Button onClick={() => setCurrentStep((s) => Math.min(5, s + 1))}>Continue</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : 'Submit Product'}
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
