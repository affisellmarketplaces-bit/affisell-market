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
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
  }, [router, supabase])

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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Add new product</h1>

        {/* Product name */}
        <div className="mb-6">
          <label className="block font-medium mb-2">Product name *</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Wireless Bluetooth Headphones"
          />
          {isCategorizing && <p className="text-sm text-purple-600 mt-2">AI is analyzing your product...</p>}
        </div>

        {/* Images - TikTok style */}
        <div className="mb-6">
          <label className="block font-medium mb-2">Product photos and videos *</label>
          <p className="text-sm text-gray-500 mb-3">Upload up to 10 images. First image will be the cover.</p>
          <label className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500 block">
            <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
            <div className="text-gray-500">Click to upload or drag and drop</div>
          </label>
          <div className="flex gap-3 mt-3 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative">
                <img src={img} className="w-24 h-24 object-cover rounded-lg" alt={`upload-${i}`} />
                {i === 0 && <span className="absolute top-1 left-1 bg-black text-white text-xs px-2 py-0.5 rounded">Cover</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Categories - Auto-filled like TikTok */}
        <div className="mb-6">
          <label className="block font-medium mb-2">
            Category *
            <span className="text-sm font-normal text-gray-500 ml-2">Auto-selected by AI, you can edit</span>
          </label>
          <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ALL_CATEGORIES.map(cat => (
                <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    className="rounded text-purple-600"
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
          <p className="text-sm mt-2">Selected: <span className="font-medium">{selectedCategories.length}/3</span></p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {selectedCategories.map(cat => (
              <span key={cat} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">{cat}</span>
            ))}
          </div>
        </div>

        {/* Price + Stock */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block font-medium mb-2">Price *</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">EUR</span>
              <input type="number" className="w-full border border-gray-300 rounded-lg pl-12 pr-4 py-3" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="block font-medium mb-2">Quantity *</label>
            <input type="number" className="w-full border border-gray-300 rounded-lg px-4 py-3" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" />
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="block font-medium mb-2">Description</label>
          <textarea className="w-full border border-gray-300 rounded-lg px-4 py-3" rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your product..." />
        </div>

        {/* Commission */}
        <div className="mb-6">
          <label className="block font-medium mb-2">Affiliate Commission (%)</label>
          <input type="number" className="w-full border border-gray-300 rounded-lg px-4 py-3" value={commission} onChange={e => setCommission(Number(e.target.value))} />
        </div>

        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 rounded-lg">
          Publish Product
        </button>
      </div>
    </div>
  )
}
