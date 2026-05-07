'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [loadingAI, setLoadingAI] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [images, setImages] = useState<string[]>([])
  const productName = productTitle
  const router = useRouter()

  useEffect(() => {
    if (!categoryId) return setAttributes([])
    fetch(`/api/categories/${categoryId}/attributes`).then(r=>r.json()).then(setAttributes)
    setSpecs({})
  }, [categoryId])

  const handleAutoFill = async () => {
    const imageUrl = imageUrls[0]?.startsWith('http') ? imageUrls[0] : undefined
    if (!productName && !imageUrl) return toast.error('Add title or image first')
    setLoadingAI(true)
    try {
      const res = await fetch('/api/ai/suggest-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle: productName || undefined, imageUrl })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setCategoryId(data.categoryId)
      setCategoryName(data.categoryName)
      setSpecs(data.specs || {})
      toast.success(`Detected: ${data.categoryName}`)
    } catch (e) {
      console.error(e)
      toast.error((e as Error).message)
    } finally {
      setLoadingAI(false)
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
          <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Upload image or enter name, then detect category</p>
            <Button 
              type="button"
              onClick={handleAutoFill}
              disabled={loadingAI || (!productName && !imageUrls.length)}
            >
              {loadingAI ? 'Detecting...' : 'Auto-fill with AI'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold">Technical Specifications</h3>
                <p className="text-sm text-muted-foreground">Category: {categoryName}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAutoFill} disabled={loadingAI}>
                {loadingAI ? 'Filling...' : 'Re-run AI'}
              </Button>
            </div>
            {attributes.map((attr) => (
              <div key={attr.key}>
                <Label>{attr.label}{attr.required && ' *'}</Label>
                <Input
                  value={specs[attr.key] || ''}
                  onChange={e => setSpecs({...specs, [attr.key]: e.target.value})}
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
