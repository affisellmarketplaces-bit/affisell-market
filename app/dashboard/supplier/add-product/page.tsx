'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ProductSpecsTable from '@/components/supplier/ProductSpecsTable'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function AddProductPage() {
  const [productTitle, setProductTitle] = useState('')
  const [categoryId, setCategoryId] = useState('cmoumgx890003thk6x057t2la')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [specs, setSpecs] = useState<Record<string, string>>({})
  const [images, setImages] = useState<string[]>([])
  const router = useRouter()

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
              <SelectItem value="cmoumgx890003thk6x057t2la">Electronics / Cell Phones / Smartphones</SelectItem>
            </SelectContent>
          </Select>
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

        <ProductSpecsTable 
          categoryId={categoryId}
          productTitle={productTitle}
          images={images}
          onSpecsChange={setSpecs}
        />

        <Button onClick={handleSubmit} className="w-full" size="lg">
          Create Product Listing
        </Button>
      </Card>
    </div>
  )
}
