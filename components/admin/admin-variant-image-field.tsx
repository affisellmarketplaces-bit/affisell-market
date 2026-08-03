"use client"

import { useCallback, useRef, useState } from "react"
import { ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ColorSwatchSizeError, processColorSwatchFile } from "@/lib/color-swatch-image"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  onChange: (image: string) => void
  disabled?: boolean
  label?: string
}

async function uploadProcessedImage(file: File): Promise<string | null> {
  const fd = new FormData()
  fd.set("file", file)
  const res = await fetch("/api/upload/processed-image", {
    method: "POST",
    body: fd,
    credentials: "include",
  })
  if (!res.ok) return null
  const data = (await res.json()) as { url?: string }
  return typeof data.url === "string" && data.url.trim() ? data.url.trim() : null
}

/**
 * Admin variant photo: HTTPS URL paste or file upload (CDN when possible).
 */
export function AdminVariantImageField({
  value,
  onChange,
  disabled = false,
  label = "Photo variante",
}: Props) {
  const [urlDraft, setUrlDraft] = useState(() => (value.startsWith("http") ? value : ""))
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const applyUrl = useCallback(() => {
    const t = urlDraft.trim()
    if (!/^https?:\/\//i.test(t)) {
      toast.error("Collez une URL image https://…")
      return
    }
    onChange(t)
    toast.success("Photo enregistrée")
  }, [onChange, urlDraft])

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled) return
      setBusy(true)
      try {
        const uploaded = await uploadProcessedImage(file)
        if (uploaded) {
          onChange(uploaded)
          setUrlDraft(uploaded)
          toast.success("Photo uploadée")
          return
        }
        // Fallback: compact data URL for colorImages
        const dataUrl = await processColorSwatchFile(file)
        onChange(dataUrl)
        setUrlDraft("")
        toast.success("Photo ajoutée")
      } catch (e) {
        if (e instanceof ColorSwatchSizeError) {
          toast.error(`${e.fileName} : min. ${e.minW}×${e.minH} px.`)
        } else {
          toast.error(e instanceof Error ? e.message : "Upload impossible")
        }
      } finally {
        setBusy(false)
      }
    },
    [disabled, onChange]
  )

  const preview = value.trim()

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap items-start gap-3">
        <div
          className={cn(
            "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed",
            preview
              ? "border-violet-300 bg-white dark:border-violet-700"
              : "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-zinc-400" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-2">
            <Input
              value={urlDraft}
              disabled={disabled || busy}
              placeholder="https://ae01.alicdn.com/…"
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  applyUrl()
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || busy}
              onClick={applyUrl}
              className="shrink-0 gap-1"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              OK
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || busy}
              className="gap-1"
              onClick={() => fileRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-3.5 w-3.5" aria-hidden />
              )}
              Fichier
            </Button>
            {preview ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || busy}
                className="gap-1 text-red-600"
                onClick={() => {
                  onChange("")
                  setUrlDraft("")
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Retirer
              </Button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              void onFile(f)
            }}
          />
        </div>
      </div>
    </div>
  )
}
