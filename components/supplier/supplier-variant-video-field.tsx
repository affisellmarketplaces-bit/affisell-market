"use client"

import { Film, Loader2, Upload } from "lucide-react"
import type { ChangeEvent } from "react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uploadSupplierVideoFile } from "@/lib/supplier-variant-video-upload"
import { cn } from "@/lib/utils"

type Props = {
  value: string | null
  onChange: (url: string | null) => void
  disabled?: boolean
  className?: string
  inputClassName?: string
  /** Compact layout for SKU table cells */
  compact?: boolean
}

export function SupplierVariantVideoField({
  value,
  onChange,
  disabled = false,
  className,
  inputClassName,
  compact = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadSupplierVideoFile(file)
      onChange(url)
      toast.success("Vidéo importée")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible")
    } finally {
      setUploading(false)
    }
  }

  const hasUrl = Boolean(value?.trim())

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-1">
        {hasUrl ? (
          <Film
            className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400"
            aria-hidden
          />
        ) : null}
        <Input
          className={cn(
            compact ? "h-9 min-w-[100px] flex-1 text-xs" : "h-10 flex-1 text-sm",
            inputClassName
          )}
          value={value ?? ""}
          disabled={disabled || uploading}
          placeholder="https://… ou fichier"
          onChange={(e) => onChange(e.target.value.trim() || null)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(e) => void onFileSelected(e)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("shrink-0", compact ? "h-9 w-9" : "h-10 w-10")}
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
          aria-label="Importer un fichier vidéo"
          title="Importer MP4, WebM ou MOV (max 48 Mo)"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>
      {!compact ? (
        <p className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
          Lien YouTube / Vimeo / MP4, ou importez un fichier.
        </p>
      ) : null}
    </div>
  )
}
