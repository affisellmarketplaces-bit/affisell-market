"use client"

import { useCallback, useId, useRef, useState } from "react"
import { ImagePlus, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { processProductGalleryImageFile } from "@/lib/product-image-upload"
import {
  canPublishWithUploads,
  createUploadSlot,
  publishBlockedUploadMessage,
  runZeroWaitUpload,
  type ZeroWaitUploadSlot,
} from "@/lib/upload/zero-wait-uploader"
import { cn } from "@/lib/utils"

type Props = {
  onUrlsChange: (urls: string[]) => void
  onBusyChange?: (busy: boolean) => void
  className?: string
}

async function uploadProcessedBlob(blob: Blob, fileName: string): Promise<string> {
  const form = new FormData()
  form.append("file", blob, `${fileName}.jpg`)
  const res = await fetch("/api/upload/processed-image", {
    method: "POST",
    credentials: "include",
    body: form,
  })
  const json = (await res.json()) as { url?: string; detail?: string; error?: string }
  if (!res.ok) throw new Error(json.detail ?? json.error ?? "upload_failed")
  const url = json.url?.trim()
  if (!url) throw new Error("missing_url")
  return url
}

export function WizardV2ZeroWaitUpload({ onUrlsChange, onBusyChange, className }: Props) {
  const inputId = useId()
  const [slots, setSlots] = useState<ZeroWaitUploadSlot[]>([])
  const slotsRef = useRef(slots)
  slotsRef.current = slots

  const syncUrls = useCallback(
    (next: ZeroWaitUploadSlot[]) => {
      const urls = next.map((s) => s.durableUrl).filter((u): u is string => Boolean(u))
      onUrlsChange(urls)
      const busy = next.some((s) => s.status === "processing" || s.status === "uploading")
      onBusyChange?.(busy)
    },
    [onBusyChange, onUrlsChange]
  )

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return
      const file = files[0]!
      const id = `zw-${Date.now()}`
      const base = createUploadSlot(id, file)
      setSlots((prev) => [...prev, base])

      const updated = await runZeroWaitUpload({
        slot: base,
        file,
        processFile: processProductGalleryImageFile,
        uploadWhole: uploadProcessedBlob,
        onUpdate: (patch) => {
          setSlots((prev) => {
            const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
            syncUrls(next)
            return next
          })
        },
      })

      if (updated.status === "error") {
        toast.error(updated.error ?? "Upload impossible")
      } else {
        toast.success("Photo prête sur le CDN")
      }
    },
    [syncUrls]
  )

  const blocked = publishBlockedUploadMessage(slots)
  const ready = canPublishWithUploads(slots)

  return (
    <div className={cn("space-y-3", className)}>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-300/60 bg-violet-50/50 px-6 py-10 text-center transition hover:border-violet-500 dark:border-violet-800 dark:bg-violet-950/20"
      >
        <ImagePlus className="h-8 w-8 text-violet-600" aria-hidden />
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Glissez une photo — upload CDN immédiat
        </span>
        <span className="text-xs text-zinc-500">Vous pouvez continuer pendant l&apos;envoi</span>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </label>

      {slots.map((slot) => (
        <div
          key={slot.id}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium">{slot.fileName}</span>
            <span className="shrink-0 text-zinc-500">{slot.status}</span>
          </div>
          {(slot.status === "processing" || slot.status === "uploading") && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full bg-violet-600 transition-all"
                style={{ width: `${slot.progress}%` }}
                role="progressbar"
                aria-valuenow={slot.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          )}
          {slot.status === "uploading" ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-violet-700 dark:text-violet-300">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Upload en cours, continuez à remplir le formulaire
            </p>
          ) : null}
          {slot.error ? <p className="mt-1 text-xs text-red-600">{slot.error}</p> : null}
        </div>
      ))}

      {blocked && slots.length > 0 ? (
        <p className={cn("text-xs", ready ? "text-emerald-600" : "text-amber-700")} role="note">
          {blocked}
        </p>
      ) : null}
    </div>
  )
}

export function useWizardV2UploadGate(slots: ZeroWaitUploadSlot[]) {
  return {
    canPublish: canPublishWithUploads(slots),
    message: publishBlockedUploadMessage(slots),
  }
}
