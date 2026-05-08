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
  const debounceRef = useRef<NodeJS.Timeout>()

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

  const runAutoCategorize = async (currentTitle: string, imageUrl?: string) => {
    if (currentTitle.length < 3 &&!imageUrl) return
    setIsCategorizing(true)
    try {
      const res = await fetch('/api/categorize-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: currentTitle, imageUrl: imageUrl || images[0] })
      })
      const data = await res.json()
      if (data.categories?.length) setSelectedCategories(data.categories.slice(0,3))
    } catch (e) { console.error(e) }
    setIsCategorizing(false)
  }

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runAutoCategorize(title), 800)
    return () => clearTimeout(debounceRef.current)
  }, [title])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const newImages = [...images, url]
    setImages(newImages)
    if (newImages.length === 1) runAutoCategorize(title, url)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-8">Add new product</h1>
        
        <div className="space-y-6">
          {/* Product name */}
          <div>
            <label className="block text-sm font-semibold mb-2">Product name *</label>
            <input 
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Wireless Bluetooth Headphones"
            />
            {isCategorizing && (
              <div className="flex items-center gap-2 mt-2 text-purple-600">
                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">AI is analyzing your product...</span>
              </div>
            )}
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-semibold mb-2">Product photos and videos *</label>
            <p className="text-sm text-gray-500 mb-3">Add up to 10 images. The first image will be the cover.</p>
            <label className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition block">
              <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" multiple />
              <div className="text-gray-400">
                <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="font-medium">Click to upload or drag and drop</p>
                <p className="text-xs mt-1">PNG, JPG up to 10MB</p>
              </div>
            </label>
            <div className="flex gap-3 mt-4 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img} className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200" />
                  {i === 0 && <span className="absolute top-1 left-1 bg-black/80 text-white text-xs px-2 py-0.5 rounded">Cover</span>}
                  <button onClick={() => setImages(images.filter((_, idx) => idx!== i))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 opacity-0 group-hover:opacity-100">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Categories - TikTok style */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Category * 
              <span className="text-sm font-normal text-gray-500 ml-2">AI will auto-select, you can edit</span>
            </label>
            <div className="border border-gray-300 rounded-lg p-4 max-h-72 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ALL_CATEGORIES.map(cat => (
                  <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input 
                      type="checkbox"
                      className="rounded text-purple-600 w-4 h-4"
                      checked={selectedCategories.includes(cat)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories(prev => [...prev, cat].slice(0,3))
                        } else {
                          setSelectedCategories(prev => prev.filter(c => c!== cat))
                        }
                      }}
                    />
                    <span>{cat}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2 flex-wrap">
                {selectedCategories.map(cat => (
                  <span key={cat} className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded-full text-sm font-medium">{cat}</span>
                ))}
              </div>
              <span className="text-sm text-gray-500">{selectedCategories.length}/3 selected</span>
            </div>
          </div>

          {/* Price + Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Price *</label>
              <div className="relative">
                <span className="absolute left-3 top-3.5 text-gray-500">€</span>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-3" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Quantity *</label>
              <input type="number" className="w-full border border-gray-300 rounded-lg px-4 py-3" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2">Description</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-4 py-3" rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your product in detail..." />
          </div>

          {/* Commission */}
          <div>
            <label className="block text-sm font-semibold mb-2">Affiliate Commission (%)</label>
            <input type="number" className="w-full border border-gray-300 rounded-lg px-4 py-3" value={commission} onChange={e => setCommission(Number(e.target.value))} />
            <p className="text-xs text-gray-500 mt-1">Commission offered to affiliates for each sale</p>
          </div>

          <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3.5 rounded-lg text-base transition">
            Publish Product
          </button>
        </div>
      </div>
    </div>
  )
}
