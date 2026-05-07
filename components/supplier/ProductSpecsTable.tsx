'use client'
import { useEffect, useState } from 'react'

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
  onSpecsChange 
}: { 
  categoryId: string
  productTitle: string 
  onSpecsChange?: (specs: Record<string, string>) => void
}) {
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [specs, setSpecs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (!categoryId) {
      setAttributes([])
      return
    }
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
    if (!productTitle) return alert('Entre un titre produit d\'abord')
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/fill-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle, attributes })
      })
      const data = await res.json()
      setSpecs(data.specs || {})
    } catch (e) {
      alert('Erreur IA. Vérifie ta clé OPENAI_API_KEY dans.env.local')
    } finally {
      setAiLoading(false)
    }
  }

  if (!categoryId) return <p className="text-gray-400 text-sm mt-2">Select a subcategory to load specs...</p>
  if (loading) return <p className="text-gray-400 text-sm mt-2">Loading specs...</p>
  if (attributes.length === 0) return <p className="text-gray-400 text-sm mt-2">No specs for this subcategory</p>

  return (
    <div className="border rounded-lg p-4 mt-4 bg-gray-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-900">Product Specifications</h3>
        <button
          type="button"
          onClick={handleAiFill}
          disabled={aiLoading ||!productTitle}
          className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aiLoading? 'Filling...' : 'Auto-fill with AI'}
        </button>
      </div>
      
      <div className="space-y-3">
        {attributes.map((attr) => (
          <div key={attr.id} className="grid grid-cols-3 gap-3 items-center">
            <label className="text-sm font-medium text-gray-700">
              {attr.label}
              {attr.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            
            {attr.type === 'SELECT'? (
              <select
                className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-sm"
                value={specs[attr.key] || ''}
                onChange={(e) => setSpecs(prev => ({...prev, [attr.key]: e.target.value }))}
              >
                <option value="">Select...</option>
                {attr.options?.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <div className="col-span-2 flex gap-2">
                <input
                  type={attr.type === 'NUMBER'? 'number' : 'text'}
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                  value={specs[attr.key] || ''}
                  onChange={(e) => setSpecs(prev => ({...prev, [attr.key]: e.target.value }))}
                  placeholder={attr.label}
                />
                {attr.unit && <span className="text-sm text-gray-500 self-center">{attr.unit}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
