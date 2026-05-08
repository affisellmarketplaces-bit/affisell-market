'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Sparkles, ClipboardPaste } from 'lucide-react'

type Attribute = {
  id: string
  key: string
  label: string
  type: string
  required: boolean
  options?: string[]
}

export default function ProductSpecsTable({ 
  categoryId, 
  productTitle, 
  images, 
  onSpecsChange 
}: {
  categoryId: string
  productTitle: string
  images?: string[]
  onSpecsChange: (specs: Record<string, string>) => void
}) {
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!categoryId) return
    fetch(`/api/attributes/by-category?categoryId=${categoryId}`)
     .then(r => r.json())
     .then(data => setAttributes(data.attributes || []))
  }, [categoryId])

  useEffect(() => {
    onSpecsChange(values)
  }, [values, onSpecsChange])

  const handleAutoFill = async () => {
    if (!productTitle) {
      toast.error('Enter product title first')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/fill-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productTitle, 
          attributes,
          imageUrl: images?.[0] || null 
        })
      })
      const data = await res.json()
      setValues(prev => ({...prev,...data.specs }))
      toast.success('Specs auto-filled')
    } catch (e) {
      toast.error('AI fill failed')
    }
    setLoading(false)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const rows = text.split('\n').map(r => r.split('\t'))
      const newValues = {...values }
      rows.forEach(([key, val]) => {
        const attr = attributes.find(a => 
          a.key.toLowerCase() === key?.toLowerCase() || 
          a.label.toLowerCase() === key?.toLowerCase()
        )
        if (attr && val) newValues[attr.key] = val.trim()
      })
      setValues(newValues)
      toast.success('Pasted from Excel')
    } catch (e) {
      toast.error('Paste failed')
    }
  }

  const filled = Object.keys(values).filter(k => values[k]).length
  const required = attributes.filter(a => a.required).length

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Product Specifications</h3>
          <p className="text-sm text-gray-500">
            {filled}/{attributes.length} filled. Required: {required}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePaste}>
            <ClipboardPaste className="w-4 h-4 mr-2" />
            Paste from Excel
          </Button>
          <Button size="sm" onClick={handleAutoFill} disabled={loading}>
            <Sparkles className="w-4 h-4 mr-2" />
            {loading? 'Filling...' : 'Auto-fill with AI'}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {attributes.map(attr => (
          <div key={attr.id}>
            <label className="text-sm font-medium">
              {attr.label} {attr.required && '*'}
            </label>
            <Input
              value={values[attr.key] || ''}
              onChange={(e) => setValues(prev => ({...prev, [attr.key]: e.target.value }))}
              placeholder={attr.options?.join(', ') || attr.label}
              className="mt-1"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
