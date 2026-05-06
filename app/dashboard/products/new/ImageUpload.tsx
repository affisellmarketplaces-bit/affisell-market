"use client"

import { Loader2, Upload, X } from "lucide-react"
import type { ChangeEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"

const CANVAS = 1200
const PAD = 120

type ImageUploadProps = {
  onImagesChange: (urls: string[]) => void
}

export default function ImageUpload({ onImagesChange }: ImageUploadProps) {
  const [images, setImages] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)

  const processImage = async (file: File): Promise<string> => {
    const { removeBackground } = await import("@imgly/background-removal")
    const blob = await removeBackground(file)

    return new Promise((resolve, reject) => {
      const blobUrl = URL.createObjectURL(blob)
      const img = new window.Image()
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          canvas.width = CANVAS
          canvas.height = CANVAS
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            reject(new Error("No canvas"))
            return
          }

          ctx.fillStyle = "#F5F5F5"
          ctx.fillRect(0, 0, CANVAS, CANVAS)

          const maxSize = CANVAS - PAD * 2
          const scale = Math.min(maxSize / img.width, maxSize / img.height)
          const width = img.width * scale
          const height = img.height * scale
          const x = (CANVAS - width) / 2
          const y = (CANVAS - height) / 2

          ctx.drawImage(img, x, y, width, height)
          resolve(canvas.toDataURL("image/jpeg", 0.9))
        } finally {
          URL.revokeObjectURL(blobUrl)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl)
        reject(new Error("decode"))
      }
      img.src = blobUrl
    })
  }

  async function measureFile(file: File): Promise<{ width: number; height: number }> {
    const url = URL.createObjectURL(file)
    try {
      return await new Promise((resolve, reject) => {
        const el = new window.Image()
        el.onload = () => resolve({ width: el.width, height: el.height })
        el.onerror = () => reject(new Error("dim"))
        el.src = url
      })
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (files.length === 0) return

    setProcessing(true)

    try {
      for (const file of files) {
        const dimensions = await measureFile(file)

        if (dimensions.width < 800 || dimensions.height < 800) {
          toast.error(`${file.name}: Minimum 800x800px required`)
          continue
        }

        const processed = await processImage(file)
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
          Auto-converted to {CANVAS}x{CANVAS} with #F5F5F5 background
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
