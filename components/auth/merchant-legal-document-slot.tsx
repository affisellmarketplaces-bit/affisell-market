"use client"

import { useRef, useState } from "react"
import { CheckCircle2, FileUp, Loader2 } from "lucide-react"

import type { MerchantDocumentType } from "@/lib/merchant-legal/merchant-legal-status-shared"
import { cn } from "@/lib/utils"

type Props = {
  draftId: string
  documentType: MerchantDocumentType
  label: string
  hint: string
  required: boolean
  uploadedUrl: string | null
  onUploaded: (url: string) => void
  onError: (message: string) => void
}

export function MerchantLegalDocumentSlot({
  draftId,
  documentType,
  label,
  hint,
  required,
  uploadedUrl,
  onUploaded,
  onError,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | null) {
    if (!file) return
    setBusy(true)
    onError("")
    try {
      const form = new FormData()
      form.set("draftId", draftId)
      form.set("documentType", documentType)
      form.set("file", file)
      const res = await fetch("/api/auth/signup/document", { method: "POST", body: form })
      const data = (await res.json()) as { ok?: boolean; fileUrl?: string; error?: string }
      if (!res.ok || !data.ok || !data.fileUrl) {
        onError(data.error ?? "upload_failed")
        return
      }
      onUploaded(data.fileUrl)
    } catch {
      onError("upload_failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 transition",
        uploadedUrl
          ? "border-emerald-400/60 bg-emerald-50/50 dark:border-emerald-700/50 dark:bg-emerald-950/30"
          : "border-white/20 bg-white/5 hover:border-white/35"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            {label}
            {required ? <span className="text-rose-300"> *</span> : null}
          </p>
          <p className="mt-0.5 text-[11px] text-violet-100/75">{hint}</p>
        </div>
        {uploadedUrl ? (
          <CheckCircle2 className="size-5 shrink-0 text-emerald-400" aria-hidden />
        ) : (
          <FileUp className="size-5 shrink-0 text-violet-200/60" aria-hidden />
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-3 w-full rounded-xl border border-dashed border-white/25 bg-black/20 px-3 py-2.5 text-xs font-medium text-violet-50 transition hover:border-violet-300/50 hover:bg-violet-950/40 disabled:opacity-60"
      >
        {busy ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Envoi sécurisé…
          </span>
        ) : uploadedUrl ? (
          "Remplacer le fichier"
        ) : (
          "PDF ou image · max 8 Mo"
        )}
      </button>
    </div>
  )
}
