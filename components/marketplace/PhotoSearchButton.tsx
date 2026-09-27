"use client"

import { Camera, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useRef, useState } from "react"
import { toast } from "sonner"

import { compressImageFileToDataUrl } from "@/lib/client-image-compress"
import { cn } from "@/lib/utils"

type Props = {
  onQuery: (query: string) => void
  className?: string
}

/**
 * Camera icon in a search bar: pick a photo, an AI vision call turns it into a short search
 * query, then hands that query back to the caller (which runs it through the existing text
 * search — no new catalog index to build or keep in sync).
 */
export function PhotoSearchButton({ onQuery, className }: Props) {
  const t = useTranslations("PublicNav.photoSearch")
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error(t("invalidFile"))
      return
    }

    setBusy(true)
    try {
      const dataUrl = await compressImageFileToDataUrl(file)
      const res = await fetch("/api/marketplace/search-by-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      })
      const data = (await res.json().catch(() => ({}))) as { query?: string; error?: string }
      if (!res.ok || !data.query) {
        toast.error(t("failed"))
        return
      }
      onQuery(data.query)
    } catch {
      toast.error(t("failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <label htmlFor={inputId} className="sr-only">
        {t("label")}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={busy}
        onChange={(e) => void onFileChange(e)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={t("label")}
        title={t("label")}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-60 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
          className
        )}
      >
        {busy ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : <Camera className="size-[18px]" aria-hidden />}
      </button>
    </>
  )
}
