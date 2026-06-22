"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImagePlus, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Props = {
  productId: string
}

export function SupplierTryOnPanel({ productId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [garmentUrl, setGarmentUrl] = useState("")
  const [apparelEligible, setApparelEligible] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/supplier/products/${productId}/try-on`, {
        credentials: "include",
      })
      const data = (await res.json()) as {
        tryOnEnabled?: boolean
        tryOnGarmentUrl?: string | null
        apparelEligible?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Load failed")
      setEnabled(Boolean(data.tryOnEnabled))
      setGarmentUrl(data.tryOnGarmentUrl ?? "")
      setApparelEligible(Boolean(data.apparelEligible))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void load()
  }, [load])

  const uploadGarment = useCallback(
    async (file: File) => {
      setUploading(true)
      try {
        const form = new FormData()
        form.append("file", file)
        const res = await fetch(`/api/supplier/products/${productId}/try-on/garment`, {
          method: "POST",
          credentials: "include",
          body: form,
        })
        const data = (await res.json()) as { tryOnGarmentUrl?: string; error?: string }
        if (!res.ok) throw new Error(data.error ?? "Upload failed")
        if (!data.tryOnGarmentUrl) throw new Error("No URL returned")
        setGarmentUrl(data.tryOnGarmentUrl)
        toast.success("Garment PNG uploaded")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload error")
      } finally {
        setUploading(false)
      }
    },
    [productId]
  )

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/supplier/products/${productId}/try-on`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tryOnEnabled: enabled,
          tryOnGarmentUrl: garmentUrl.trim() || null,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      toast.success("Try-on settings saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error")
    } finally {
      setSaving(false)
    }
  }, [enabled, garmentUrl, productId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading try-on…
      </div>
    )
  }

  if (!apparelEligible) {
    return (
      <p className="text-sm text-zinc-500">
        Virtual try-on is available for apparel categories only. Update the product category first.
      </p>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex items-center gap-2">
        <ImagePlus className="h-5 w-5 text-violet-600" aria-hidden />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Try-On (apparel)</h3>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded"
        />
        Enable Try Before You Buy on marketplace
      </label>
      <div className="space-y-2">
        <Label htmlFor="tryon-garment-url">Transparent PNG flat-lay (required)</Label>
        {garmentUrl ? (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={garmentUrl} alt="Try-on garment preview" className="mx-auto max-h-40 object-contain" />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            className="gap-2"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            Upload PNG
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void uploadGarment(file)
            e.target.value = ""
          }}
        />
        <input
          id="tryon-garment-url"
          type="url"
          value={garmentUrl}
          onChange={(e) => setGarmentUrl(e.target.value)}
          placeholder="https://…/garment-cutout.png"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
        <p className="text-xs text-zinc-500">
          Cut-out garment only — never the hero gallery. PNG with transparent background works best.
        </p>
      </div>
      <Button type="button" disabled={saving || uploading} onClick={() => void save()}>
        {saving ? "Saving…" : "Save try-on"}
      </Button>
    </div>
  )
}
