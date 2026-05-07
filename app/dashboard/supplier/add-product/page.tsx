'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ProductSpecsTable from '@/components/supplier/ProductSpecsTable'
import ImageUpload from '@/app/dashboard/products/new/ImageUpload'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function AddProductPage() {
  const [productTitle, setProductTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [attributes, setAttributes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [specs, setSpecs] = useState<Record<string, string>>({})
  const [images, setImages] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState<string>('')
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
    if (!productTitle && !imageUrl) return toast.error('Enter product title first')
    setLoading(true)
    try {
      const res = await fetch('/api/ai/fill-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle, imageUrl: imageUrl || undefined })
      })
      const data = await res.json()
      if (data.categoryId) {
        setCategoryId(data.categoryId)
        toast.success('Category detected')
      }
      setSpecs(data.specs || {})
    } catch (e) {
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

        <div>
          <label className="text-sm font-medium">Category *</label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slow_cooker_id">Home & Kitchen → Kitchen & Dining → Slow Cookers</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!categoryId && (
          <div className="border rounded-lg p-8 text-center space-y-4">
            <p className="text-muted-foreground">Enter product title or upload an image to detect specifications</p>
            <Button 
              type="button"
              onClick={handleAutoFill}
              disabled={(!productTitle && !imageUrl) || loading}
            >
              {loading ? 'Detecting...' : 'Auto-fill with AI'}
            </Button>
          </div>
        )}
        
        <Button type="button" variant="outline" onClick={handleAutoFill} disabled={loading}>
          {loading ? 'Filling...' : 'Auto-fill with AI'}
        </Button>

        {attributes.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between">
              <h3>Technical Specifications</h3>
              <p>{Object.values(specs).filter(Boolean).length}/{attributes.length} filled</p>
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

        <ProductSpecsTable 
          categoryId={categoryId}
          productTitle={productTitle}
          images={images}
          onSpecsChange={setSpecs}
        />

        <ImageUpload
          onImagesChange={(urls) => {
            setImages(urls)
            setImageUrl(urls[0] || '')
          }}
        />

        <Button onClick={handleSubmit} className="w-full" size="lg">
          Create Product Listing
        </Button>
      </Card>
    </div>
  )
}
