'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import ImageUpload from '@/app/dashboard/products/new/ImageUpload'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function AddProductPage() {
  const [productTitle, setProductTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [categoryName, setCategoryName] = useState<string>('')
  const [attributes, setAttributes] = useState<any[]>([])
  const [specs, setSpecs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [images, setImages] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    if (!categoryId) {
      setAttributes([])
      return
    }
    fetch(`/api/categories/${categoryId}/attributes`)
    .then(res => res.json())
    .then(data => setAttributes(data))
    setSpecs({})
  }, [categoryId])

  const handleAutoFill = async () => {
    if (!productTitle && imageUrls.length === 0) return toast.error('Add title or image first')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/suggest-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productTitle: productTitle || undefined, 
          imageUrl: imageUrls[0] || undefined 
        })
      })
      const data = await res.json()
      if (data.categoryId) {
        setCategoryId(data.categoryId)
        setCategoryName(data.categoryName)
        toast.success(`Detected: ${data.categoryName}`)
      }
      setSpecs(data.specs || {})
    } catch (e) {
      console.error(e)
      toast.error('AI fill failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!productTitle || !categoryId || !price) {
      toast.error('Fill required fields: Title, Category, Price')
      return
    }
    
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title: productTitle, 
        categoryId, 
        price: parseFloat(price), 
        quantity: parseInt(quantity), 
        specs, 
        images 
      })
    })
    
    if (res.ok) {
      toast.success('Product created successfully')
      router.push('/dashboard/supplier/products')
    } else {
      toast.error('Failed to create product')
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Add a new product</h1>
      
      <Card className="p-6 space-y-6">
        <div>
          <label className="text-sm font-medium">Product Title *</label>
          <Input 
            value={productTitle} 
            onChange={(e) => setProductTitle(e.target.value)}
            placeholder="iPhone 15 Pro Max 256GB Natural Titanium"
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Price *</label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Quantity *</label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1" />
          </div>
        </div>

        <ImageUpload
          onImagesChange={(urls) => {
            setImages(urls)
            setImageUrls(urls)
          }}
        />

        {!categoryId ? (
          <div className="border rounded-lg p-8 text-center space-y-4">
            <p className="text-muted-foreground">Enter product title or upload an image to detect specifications</p>
            <Button 
              type="button"
              onClick={handleAutoFill}
              disabled={(!productTitle && imageUrls.length === 0) || loading}
            >
              {loading ? 'Detecting...' : 'Auto-fill with AI'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">Technical Specifications</h3>
                <p className="text-sm text-muted-foreground">Category: {categoryName}</p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handleAutoFill}
                disabled={loading}
              >
                {loading ? 'Filling...' : 'Re-run AI'}
              </Button>
            </div>
            {attributes.map((attr) => (
              <div key={attr.key}>
                <label>{attr.label} {attr.required && '*'}</label>
                <Input
                  value={specs[attr.key] || ''}
                  onChange={(e) => setSpecs({...specs, [attr.key]: e.target.value})}
                  required={attr.required}
                />
              </div>
            ))}
          </div>
        )}

        <Button onClick={handleSubmit} className="w-full" size="lg">
          Create Product Listing
        </Button>
      </Card>
    </div>
  )
}
