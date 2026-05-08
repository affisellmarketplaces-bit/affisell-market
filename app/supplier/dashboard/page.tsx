'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const ALL_CATEGORIES = [
  "Clothing, Shoes & Jewelry", "Collectibles & Fine Art", "Computers", "Daily Deals",
  "Digital Music", "Electronics", "Garden & Outdoor", "Gift Cards", "Grocery & Gourmet Food",
  "Handmade", "Health & Household", "Home & Kitchen", "Industrial & Scientific",
  "Luggage & Travel Gear", "Luxury Stores", "Magazine Subscriptions", "Movies & TV",
  "Musical Instruments", "Office Products", "Pet Supplies", "Prime Video", "Smart Home",
  "Software", "Sports & Outdoors", "Tools & Home Improvement", "Toys & Games",
  "Vehicles", "Video Games"
]

export default function SupplierDashboard() {
  const router = useRouter()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const [title, setTitle] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isCategorizing, setIsCategorizing] = useState(false)
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [commission, setCommission] = useState(15)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) router.push('/login')
        return
      }

      const res = await fetch('/api/auth/session', { credentials: 'include' })
      const session = await res.json().catch(() => null)
      if (!session?.user) router.push('/login')
    }

    void checkAuth()
  }, [router, supabaseUrl, supabaseAnonKey])

  // TikTok Shop behavior: auto-categorize on title OR first image
  const runAutoCategorize = async (currentTitle: string, imageUrl?: string) => {
    if (currentTitle.length < 3 && !imageUrl) return
    setIsCategorizing(true)
    try {
      const res = await fetch('/api/categorize-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: currentTitle, imageUrl: imageUrl || images[0] })
      })
      const data = await res.json()
      if (data.categories?.length) setSelectedCategories(data.categories.slice(0, 3))
    } catch (e) {
      console.error(e)
    }
    setIsCategorizing(false)
  }

  // Debounce title input
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void runAutoCategorize(title), 800)
    return () => clearTimeout(debounceRef.current)
  }, [title])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const newImages = [...images, url]
    setImages(newImages)
    if (newImages.length === 1) void runAutoCategorize(title, url) // Trigger on first image like TikTok
  }

  return (
    <div className="min-h-screen bg-[#f2f2f2] p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">Ajouter un produit</h1>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700">
              Enregistrer comme brouillon
            </button>
            <button className="rounded-md bg-[#0c9f9f] px-4 py-2 text-sm font-medium text-white">
              Soumettre pour examen
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-md border border-[#f0dca7] bg-[#fff6dc] px-4 py-3 text-sm text-[#7a5f23]">
          Ta boutique est actuellement en période probatoire. Conformément à ton niveau de période probatoire,
          tu ne peux actuellement publier que 20 annonces produit au total.
        </div>

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-lg bg-white p-4">
              <h3 className="text-2xl font-medium text-zinc-900">Suggestions</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Des informations complètes sur ton produit peuvent t'aider à en augmenter la visibilité.
              </p>
            </div>
            <div className="rounded-lg bg-white p-4">
              <h3 className="text-2xl font-medium text-zinc-900">Aperçu</h3>
              <div className="mt-3 rounded-md border border-zinc-100 bg-zinc-50 p-3">
                <p className="text-sm font-medium text-zinc-700">Détails produit</p>
                <div className="mt-4 h-56 rounded bg-zinc-100" />
              </div>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-lg bg-white p-5">
              <h2 className="mb-4 text-2xl font-semibold text-zinc-900">Informations de base</h2>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-zinc-800">Images *</label>
                <p className="mb-3 text-xs text-zinc-500">
                  Nous recommandons d'ajouter au moins 5 images pour bien représenter ton produit.
                </p>
                <label className="block cursor-pointer rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500 hover:border-zinc-500">
                  <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                  Importer l'image principale
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} alt={`upload-${i}`} className="h-20 w-20 rounded-md object-cover" />
                      {i === 0 ? (
                        <span className="absolute left-1 top-1 rounded bg-black px-1.5 py-0.5 text-[10px] text-white">
                          Cover
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium text-zinc-800">Nom du produit *</label>
                <input
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Saisis le nom du produit"
                />
                {isCategorizing ? (
                  <p className="mt-1 text-xs text-[#7c3aed]">AI analyse ton produit...</p>
                ) : null}
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-zinc-800">
                  Catégorie * <span className="font-normal text-zinc-500">· 3 suggestions</span>
                </label>
                <div className="max-h-60 overflow-y-auto rounded-md border border-zinc-300 p-3">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {ALL_CATEGORIES.map(cat => (
                      <label key={cat} className="flex items-center gap-2 text-xs text-zinc-700">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories(prev => [...prev, cat].slice(0, 3))
                            } else {
                              setSelectedCategories(prev => prev.filter(c => c !== cat))
                            }
                          }}
                        />
                        <span>{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-xs text-zinc-500">Sélectionné: {selectedCategories.length}/3</p>
              </div>
            </div>

            <div className="rounded-lg bg-white p-5">
              <h2 className="mb-3 text-2xl font-semibold text-zinc-900">Détails du produit</h2>
              <label className="mb-2 block text-sm font-medium text-zinc-800">Description</label>
              <textarea
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                rows={8}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-white p-5">
              <h2 className="mb-3 text-2xl font-semibold text-zinc-900">Informations sur les ventes</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">Prix *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-zinc-500">EUR</span>
                    <input
                      type="number"
                      className="w-full rounded-md border border-zinc-300 py-2 pl-12 pr-3 text-sm"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-800">Stock *</label>
                  <input
                    type="number"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={stock}
                    onChange={e => setStock(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-2 block text-sm font-medium text-zinc-800">Commission affiliation (%)</label>
                <input
                  type="number"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={commission}
                  onChange={e => setCommission(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="rounded-lg bg-white p-5">
              <h2 className="text-2xl font-semibold text-zinc-900">Expédition</h2>
              <p className="mt-1 text-sm text-zinc-500">Choisis d'abord une catégorie</p>
            </div>
          </section>
        </div>

        <button className="mt-4 w-full rounded-md bg-[#0c9f9f] py-3 text-sm font-medium text-white hover:bg-[#0b8a8a]">
          Publier le produit
        </button>
      </div>
    </div>
  )
}
