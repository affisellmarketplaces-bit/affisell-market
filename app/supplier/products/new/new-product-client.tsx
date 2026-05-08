"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function NewSupplierProductClient() {
  const [productName, setProductName] = useState("")
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState("")
  const [categoryName, setCategoryName] = useState("")
  const [attributes, setAttributes] = useState<any[]>([])
  const [specs, setSpecs] = useState<Record<string, string>>({})
  const [loadingAI, setLoadingAI] = useState(false)

  useEffect(() => {
    if (!categoryId) return setAttributes([])
    fetch(`/api/categories/${categoryId}/attributes`).then(r=>r.json()).then(setAttributes)
    setSpecs({})
  }, [categoryId])

  const handleAutoFill = async () => {
    const imageUrl = imageUrls[0]?.startsWith("http") ? imageUrls[0] : undefined
    if (!productName && !imageUrl) return toast.error("Add title or image first")
    setLoadingAI(true)
    try {
      const res = await fetch("/api/ai/suggest-specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productTitle: productName || undefined, imageUrl })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "AI failed")
      setCategoryId(data.categoryId)
      setCategoryName(data.categoryName)
      setSpecs(data.specs || {})
      toast.success(`Detected: ${data.categoryName}`)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingAI(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <Label>Product Name</Label>
        <Input
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="Enter product title"
        />
      </div>

      <div className="space-y-2">
        <Label>Image URL</Label>
        <Input
          value={imageUrls[0] || ""}
          onChange={(e) => setImageUrls(e.target.value ? [e.target.value] : [])}
          placeholder="https://..."
        />
      </div>

      {!categoryId ? (
        <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">Enter title or image URL, then let AI detect the category</p>
          <Button type="button" onClick={handleAutoFill} disabled={loadingAI || (!productName && !imageUrls[0])}>
            {loadingAI ? "Detecting..." : "Auto-fill with AI"}
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
              {loadingAI ? "Filling..." : "Re-run AI"}
            </Button>
          </div>
          {attributes.map(attr => (
            <div key={attr.key}>
              <Label>{attr.label}{attr.required && " *"}</Label>
              <Input value={specs[attr.key] || ""} onChange={e => setSpecs({...specs, [attr.key]: e.target.value})} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
