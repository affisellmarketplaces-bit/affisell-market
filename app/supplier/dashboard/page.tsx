'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function SupplierDashboard() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.push('/login')
    }
    checkAuth()
  }, [router, supabase])

  // States
  const [title, setTitle] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isCategorizing, setIsCategorizing] = useState(false)
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [commission, setCommission] = useState(15)

  const ALL_CATEGORIES = [
    "Clothing, Shoes & Jewelry", "Collectibles & Fine Art", "Computers", "Daily Deals", 
    "Digital Music", "Electronics", "Garden & Outdoor", "Gift Cards", "Grocery & Gourmet Food", 
    "Handmade", "Health & Household", "Home & Kitchen", "Industrial & Scientific", 
    "Luggage & Travel Gear", "Luxury Stores", "Magazine Subscriptions", "Movies & TV", 
    "Musical Instruments", "Office Products", "Pet Supplies", "Prime Video", "Smart Home", 
    "Software", "Sports & Outdoors", "Tools & Home Improvement", "Toys & Games", 
    "Vehicles", "Video Games"
  ]

  // Auto-categorize on title change with debounce
  useEffect(() => {
    if (title.length < 3) return
    const timer = setTimeout(async () => {
      setIsCategorizing(true)
      try {
        const res = await fetch('/api/categorize-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, imageUrl: images[0] || null })
        })
        const data = await res.json()
        setSelectedCategories(data.categories || [])
      } catch (e) {
        console.error(e)
      }
      setIsCategorizing(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [title, images])

  // Auto-categorize on first image upload
  const handleImageUpload = async (url: string) => {
    const newImages = [...images, url]
    setImages(newImages)
    if (newImages.length === 1) {
      setIsCategorizing(true)
      const res = await fetch('/api/categorize-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, imageUrl: url })
      })
      const data = await res.json()
      setSelectedCategories(data.categories || [])
      setIsCategorizing(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add Product</h1>
      
      {/* Product Name */}
      <div className="mb-4">
        <label>Product name *</label>
        <input 
          className="w-full border p-2 rounded"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="What are you selling?"
        />
      </div>

      {/* Images */}
      <div className="mb-4">
        <label>Product Images (up to 10) *</label>
        <input type="file" onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleImageUpload(URL.createObjectURL(file))
        }} />
        <div className="flex gap-2 mt-2">
          {images.map((img, i) => <img key={i} src={img} className="w-20 h-20 object-cover" />)}
        </div>
      </div>

      {/* Categories - TikTok Style */}
      <div className="mb-4">
        <label>
          Categories (max 3) 
          {isCategorizing && <span className="text-blue-500 ml-2">AI analyzing...</span>}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-64 overflow-y-auto border p-3 rounded">
          {ALL_CATEGORIES.map(cat => (
            <label key={cat} className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox"
                checked={selectedCategories.includes(cat)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedCategories(prev => [...prev, cat].slice(0,3))
                  } else {
                    setSelectedCategories(prev => prev.filter(c => c!== cat))
                  }
                }}
              />
              {cat}
            </label>
          ))}
        </div>
        <p className="text-sm mt-1">Selected: {selectedCategories.length}/3</p>
      </div>

      {/* Price + Stock */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label>Base price (EUR) *</label>
          <input type="number" className="w-full border p-2 rounded" value={price} onChange={e => setPrice(e.target.value)} />
        </div>
        <div>
          <label>Stock *</label>
          <input type="number" className="w-full border p-2 rounded" value={stock} onChange={e => setStock(e.target.value)} />
        </div>
      </div>

      {/* Description */}
      <div className="mb-4">
        <label>Description</label>
        <textarea className="w-full border p-2 rounded" rows={4} value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      {/* Commission */}
      <div className="mb-4">
        <label>Offered Commission For Affiliates (%)</label>
        <input type="number" className="w-full border p-2 rounded" value={commission} onChange={e => setCommission(Number(e.target.value))} />
      </div>

      <button className="bg-purple-600 text-white px-6 py-2 rounded">
        Publish Product
      </button>
    </div>
  )
}
