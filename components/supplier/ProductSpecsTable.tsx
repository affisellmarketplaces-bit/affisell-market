"use client"
import { useState, useEffect } from "react"
import { Sparkles, Loader2 } from 'lucide-react'

export function ProductSpecsTable({ categoryId, title, imageUrl, onChange }: {
  categoryId: string
  title: string
  imageUrl?: string
  onChange: (specs: Record<string, any>) => void
}) {
  const [attributes, setAttributes] = useState<any[]>([])
  const [values, setValues] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (!categoryId) return
    setLoading(true)
    fetch(`/api/categories/${categoryId}/attributes`)
      .then(r => r.json())
      .then(data => {
      setAttributes(data.attributes)
      setValues({})
      setLoading(false)
    })
  }, [categoryId])

  useEffect(() => {
    onChange(values)
  }, [values, onChange])

  const handleAISuggest = async () => {
    if (!title || !categoryId) return
    setAiLoading(true)
    const res = await fetch('/api/ai/suggest-specs', {
      method: 'POST',
      body: JSON.stringify({ title, categoryId, imageUrl })
    })
    const { suggestions } = await res.json()
    setValues(suggestions)
    setAiLoading(false)
  }

  if (!categoryId) return null
  if (loading) return <div className="p-4 text-center">Loading specs...</div>

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
        <h3 className="text-lg font-bold">Product Specifications</h3>
        <button type="button" onClick={handleAISuggest}
          disabled={aiLoading || !title}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-50">
          {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {aiLoading ? 'AI Analyzing...' : 'Auto-fill with AI'}
        </button>
      </div>
      <table className="w-full">
        <tbody>
          {attributes.map((attr) => (
            <tr key={attr.key} className="border-t">
              <td className="w-1/3 bg-gray-50 px-4 py-3 font-semibold">
                {attr.label} {attr.required && <span className="text-red-500">*</span>}
              </td>
              <td className="px-4 py-3">
                {attr.type === 'select' ? (
                  <select value={values[attr.key] || ''}
                    onChange={e => setValues({ ...values, [attr.key]: e.target.value })}
                    className="w-full rounded border p-2">
                    <option value="">Select...</option>
                    {attr.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : attr.type === 'multiselect' ? (
                  <select multiple value={values[attr.key] || []}
                    onChange={e => setValues({ ...values, [attr.key]: Array.from(e.target.selectedOptions, o => o.value) })}
                    className="h-24 w-full rounded border p-2">
                    {attr.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : attr.type === 'boolean' ? (
                  <input type="checkbox" checked={values[attr.key] === 'true'}
                    onChange={e => setValues({ ...values, [attr.key]: e.target.checked.toString() })} />
                ) : (
                  <div className="flex gap-2">
                    <input type={attr.type === 'number' ? 'number' : 'text'}
                      value={values[attr.key] || ''}
                      onChange={e => setValues({ ...values, [attr.key]: e.target.value })}
                      className="flex-1 rounded border p-2" />
                    {attr.unit && <span className="py-2 text-gray-500">{attr.unit}</span>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
