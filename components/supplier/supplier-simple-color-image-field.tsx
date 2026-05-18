"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImagePlus, Link2, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { resolveImageLinkUrl } from "@/components/supplier/supplier-product-image-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ColorSwatchSizeError, processColorSwatchFile } from "@/lib/color-swatch-image"
import { imageFilesFromDataTransfer } from "@/lib/description-illustration-image"
import { cn } from "@/lib/utils"

type ImageMode = "url" | "file"

type Props = {
  rowId: string
  value: string
  onChange: (image: string) => void
  disabled?: boolean
}

function initialMode(value: string): ImageMode {
  if (value.startsWith("data:image/")) return "file"
  return "url"
}

export function SupplierSimpleColorImageField({ rowId, value, onChange, disabled = false }: Props) {
  const [mode, setMode] = useState<ImageMode>(() => initialMode(value))
  const [urlDraft, setUrlDraft] = useState(() => (value.startsWith("http") ? value : ""))
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value.startsWith("data:image/")) {
      setMode("file")
      setUrlDraft("")
    } else if (value.startsWith("http")) {
      setMode("url")
      setUrlDraft(value)
    } else if (!value.trim()) {
      setUrlDraft("")
    }
  }, [value])

  const applyFiles = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file || disabled) return
      setBusy(true)
      try {
        const dataUrl = await processColorSwatchFile(file)
        onChange(dataUrl)
        setMode("file")
        setUrlDraft("")
        toast.success("Photo couleur ajoutée")
      } catch (e) {
        if (e instanceof ColorSwatchSizeError) {
          toast.error(`${e.fileName} : min. ${e.minW}×${e.minH} px.`)
        } else {
          toast.error(e instanceof Error ? e.message : "Impossible de traiter l'image")
        }
      } finally {
        setBusy(false)
      }
    },
    [disabled, onChange]
  )

  const applyUrl = useCallback(() => {
    const resolved = resolveImageLinkUrl(urlDraft)
    if (!resolved) {
      toast.error("Collez un lien image valide (https://…)")
      return
    }
    onChange(resolved)
    setMode("url")
    toast.success("Lien image enregistré")
  }, [onChange, urlDraft])

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (mode !== "file" || disabled) return
      const files = imageFilesFromDataTransfer(e.clipboardData)
      if (files.length === 0) return
      e.preventDefault()
      void applyFiles(files)
    },
    [applyFiles, disabled, mode]
  )

  const clearImage = () => {
    onChange("")
    setUrlDraft("")
  }

  const preview = value.trim()

  return (
    <div className="min-w-0 flex-[2] space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs">Photo couleur (optionnelle)</Label>
        <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMode("url")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition",
              mode === "url"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            )}
          >
            <Link2 className="h-3 w-3" aria-hidden />
            Lien URL
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setMode("file")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition",
              mode === "file"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            )}
          >
            <Upload className="h-3 w-3" aria-hidden />
            Fichier
          </button>
        </div>
      </div>

      {preview ? (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            className="h-14 w-14 shrink-0 rounded-md border border-zinc-100 object-cover dark:border-zinc-700"
          />
          <p className="min-w-0 flex-1 truncate text-[11px] text-zinc-500 dark:text-zinc-400">
            {preview.startsWith("data:") ? "Image importée" : preview}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-zinc-500 hover:text-red-600"
            disabled={disabled || busy}
            onClick={clearImage}
            aria-label="Retirer la photo"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {mode === "url" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            id={`v-color-img-${rowId}`}
            type="url"
            className="h-10 min-w-0 flex-1"
            value={urlDraft}
            disabled={disabled || busy}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                applyUrl()
              }
            }}
            placeholder="https://…"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={disabled || busy || !urlDraft.trim()}
            onClick={applyUrl}
          >
            Ajouter
          </Button>
        </div>
      ) : (
        <div
          ref={dropRef}
          onPaste={handlePaste}
          onDrop={(e) => {
            e.preventDefault()
            void applyFiles(imageFilesFromDataTransfer(e.dataTransfer))
          }}
          onDragOver={(e) => {
            if (imageFilesFromDataTransfer(e.dataTransfer).length) e.preventDefault()
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-4 text-center transition",
            "border-zinc-300 bg-zinc-50/80 dark:border-zinc-600 dark:bg-zinc-900/50",
            busy && "pointer-events-none opacity-70"
          )}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" aria-hidden />
          ) : (
            <ImagePlus className="h-6 w-6 text-zinc-400" aria-hidden />
          )}
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Glisser-déposer, Ctrl+V ou{" "}
            <button
              type="button"
              className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
              disabled={disabled || busy}
              onClick={() => fileRef.current?.click()}
            >
              parcourir
            </button>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={disabled || busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ""
              if (f) void applyFiles([f])
            }}
          />
        </div>
      )}
    </div>
  )
}
