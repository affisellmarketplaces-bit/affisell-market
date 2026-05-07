'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sparkles, ClipboardPaste } from 'lucide-react'
import { toast } from 'sonner'

type Attribute = {
  id: string
  key: string
  label: string
  type: 'TEXT' | 'NUMBER' | 'SELECT'
  required: boolean
  options?: string[]
  unit?: string
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
  onSpecsChange?: (specs: Record<string, string>) => void
}) {
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [specs, setSpecs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (!categoryId) return setAttributes([])
    setLoading(true)
    fetch(`/api/categories/${categoryId}/attributes`)
   .then(res => res.json())
   .then(data => setAttributes(data.attributes || []))
   .finally(() => setLoading(false))
  }, [categoryId])

  useEffect(() => {
    onSpecsChange?.(specs)
  }, [specs, onSpecsChange])

  const handleAiFill = async () => {
    if (!productTitle) return toast.error('Enter product title first')
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/fill-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle, attributes, imageUrl: images?.[0] })
      })
      const data = await res.json()
      setSpecs(prev => ({...prev,...data.specs}))
      toast.success(`Filled ${Object.keys(data.specs).length} specs`)
    } catch {
      toast.error('AI failed')
    } finally {
      setAiLoading(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\t')) return
    e.preventDefault()
    const rows = text.split('\n')
    const newSpecs = {...specs}
    rows.forEach(row => {
      const [key, value] = row.split('\t')
      const attr = attributes.find(a => a.label.toLowerCase() === key.toLowerCase() || a.key === key)
      if (attr && value) newSpecs[attr.key] = value.trim()
    })
    setSpecs(newSpecs)
    toast.success('Pasted from Excel')
  }

  const filledCount = Object.values(specs).filter(Boolean).length
  const requiredCount = attributes.filter(a => a.required).length

  if (!categoryId) return <div className="text-sm text-muted-foreground mt-4">Select a category to load specifications</div>
  if (loading) return <div className="text-sm text-muted-foreground mt-4">Loading specs...</div>

  return (
    <div className="border rounded-lg p-4 mt-6" onPaste={handlePaste}>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-semibold">Product Specifications</h3>
          <p className="text-xs text-muted-foreground">{filledCount}/{attributes.length} filled. Required: {requiredCount}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => document.getElementById('paste-area')?.focus()}>
            <ClipboardPaste className="w-4 h-4 mr-1" /> Paste from Excel
          </Button>
          <Button size="sm" onClick={handleAiFill} disabled={aiLoading}>
            <Sparkles className="w-4 h-4 mr-1" /> {aiLoading? 'Analyzing...' : 'Auto-fill with AI'}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {attributes.map((attr) => (
          <div key={attr.id}>
            <label className="text-sm font-medium">
              {attr.label}
              {attr.required && <span className="text-red-500">*</span>}
            </label>
            {attr.type === 'SELECT'? (
              <Select value={specs[attr.key] || ''} onValueChange={(v) => setSpecs(p => ({...p, [attr.key]: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {attr.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2 mt-1">
                <Input
                  type={attr.type === 'NUMBER'? 'number' : 'text'}
                  value={specs[attr.key] || ''}
                  onChange={(e) => setSpecs(p => ({...p, [attr.key]: e.target.value}))}
                  placeholder={attr.unit? `e.g. 6.1` : attr.label}
                />
                {attr.unit && <span className="text-sm text-muted-foreground self-center">{attr.unit}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      <textarea id="paste-area" className="opacity-0 h-0" />
    </div>
  )
}
