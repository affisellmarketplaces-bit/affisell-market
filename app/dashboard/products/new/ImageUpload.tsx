"use client"

import { Loader2, Upload, X } from "lucide-react"
import type { ChangeEvent } from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  measureImageFile,
  processProductImageToDataUrl,
  PRODUCT_IMAGE_CANVAS,
} from "@/lib/product-image-upload"

type ImageUploadProps = {
  onImagesChange: (urls: string[]) => void
  /** When provided (e.g. edit mode), hydrates the grid. Remote URLs skip the 800×800 upload rule. */
  initialUrls?: string[]
}

export default function ImageUpload({ onImagesChange, initialUrls }: ImageUploadProps) {
  const [images, setImages] = useState<string[]>(() => initialUrls?.filter(Boolean).slice(0, 10) ?? [])
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    const seed = initialUrls?.filter(Boolean).slice(0, 10) ?? []
    if (seed.length === 0) return
    setImages(seed)
    onImagesChange(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed when `initialUrls` changes; avoid `onImagesChange` identity loops
  }, [initialUrls?.join("|")])

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (files.length === 0) return

    setProcessing(true)

    try {
      for (const file of files) {
        const dimensions = await measureImageFile(file)

        if (dimensions.width < 800 || dimensions.height < 800) {
          toast.error(`${file.name}: Minimum 800x800px required`)
          continue
        }

        const processed = await processProductImageToDataUrl(file)
        setImages((prev) => {
          const updated = [...prev, processed].slice(0, 10)
          onImagesChange(updated)
          return updated
        })
        toast.success(`${file.name} processed`)
      }
    } catch {
      toast.error("Failed to process image")
    } finally {
      setProcessing(false)
    }
  }

  const removeAt = (i: number) => {
    setImages((prev) => {
      const next = prev.filter((_, idx) => idx !== i)
      onImagesChange(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-white">PRODUCT IMAGES</h3>
        <p className="mt-1 text-xs text-white/80">
          Auto-converted to {PRODUCT_IMAGE_CANVAS}x{PRODUCT_IMAGE_CANVAS} with #F5F5F5 background
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {images.map((img, i) => (
          <div
            key={i}
            className="relative aspect-square overflow-hidden rounded-xl border-2 border-gray-200 bg-[#F5F5F5]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URLs */}
            <img src={img} alt="" className="h-full w-full object-contain p-2" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 transition-all hover:border-violet-500 hover:bg-violet-50">
          {processing ? (
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          ) : (
            <>
              <Upload className="h-8 w-8 text-gray-400" />
              <span className="text-xs font-semibold text-gray-600">Upload</span>
            </>
          )}
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={processing || images.length >= 10}
          />
        </label>
      </div>
    </div>
  )
}
