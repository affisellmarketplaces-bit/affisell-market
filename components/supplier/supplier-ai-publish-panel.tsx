"use client"

import { useCallback, useEffect, useId, useState } from "react"
import { Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"

export type AiPublishResult = {
  description: string
  specs: Record<string, string>
  title?: string
  mergeHttpsImageUrls?: string[]
}

type Props = {
  /** Prefill when opening the dialog */
  initialTitle: string
  initialNotes: string
  initialImageUrls: string[]
  categoryAttrs: CategoryAttrRow[]
  categoryPathLabel: string
  onGenerated: (result: AiPublishResult) => void
}

type FileSlot = { id: string; dataUrl: string; name: string }

const MAX_UPLOAD_SLOTS = 4
const MAX_SIDE = 768
const JPEG_QUALITY = 0.82

async function compressImageFileToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas not available")
    ctx.drawImage(bmp, 0, 0, w, h)
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY)
  } finally {
    bmp.close?.()
  }
}

function parseUrlLines(raw: string): string[] {
  const lines = raw.split(/[\n\r]+/).map((s) => s.trim())
  const out: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    if (!/^https?:\/\//i.test(line)) continue
    if (line.length > 2000) continue
    if (seen.has(line)) continue
    seen.add(line)
    out.push(line)
    if (out.length >= 8) break
  }
  return out
}

export function SupplierAiPublishPanel({
  initialTitle,
  initialNotes,
  initialImageUrls,
  categoryAttrs,
  categoryPathLabel,
  onGenerated,
}: Props) {
  const dialogId = useId()
  const fileInputId = `${dialogId}-files`

  const [open, setOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState("")
  const [modalNotes, setModalNotes] = useState("")
  const [urlField, setUrlField] = useState("")
  const [fileSlots, setFileSlots] = useState<FileSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)

  const openDialog = useCallback(() => {
    setModalTitle(initialTitle.trim())
    setModalNotes(initialNotes.trim())
    setUrlField(initialImageUrls.filter((u) => /^https?:\/\//i.test(u)).join("\n"))
    setFileSlots([])
    setOpen(true)
  }, [initialTitle, initialNotes, initialImageUrls])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    e.target.value = ""
    if (!list?.length) return
    setFileBusy(true)
    try {
      const next: FileSlot[] = [...fileSlots]
      for (const file of Array.from(list)) {
        if (!file.type.startsWith("image/")) continue
        if (next.length >= MAX_UPLOAD_SLOTS) break
        try {
          const dataUrl = await compressImageFileToDataUrl(file)
          if (dataUrl.length > 1_200_000) {
            toast.error(`"${file.name}" is still too large after compressing. Try another image.`)
            continue
          }
          next.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            dataUrl,
            name: file.name,
          })
        } catch {
          toast.error(`Could not read "${file.name}".`)
        }
      }
      setFileSlots(next)
    } finally {
      setFileBusy(false)
    }
  }

  const removeSlot = (id: string) => {
    setFileSlots((s) => s.filter((x) => x.id !== id))
  }

  const submitModal = useCallback(async () => {
    const title = modalTitle.trim()
    const notes = modalNotes.trim()
    const httpsUrls = parseUrlLines(urlField)
    const dataUrls = fileSlots.map((s) => s.dataUrl)

    if (title.length < 2 && notes.length < 8 && httpsUrls.length === 0 && dataUrls.length === 0) {
      toast.error("Add a title (2+ characters), notes, image URLs, or upload photos.")
      return
    }

    setLoading(true)
    try {
      const characteristics = categoryAttrs.map((c) => ({
        key: c.key,
        label: c.label,
        type: c.type,
        options: c.options ?? [],
        required: c.required,
      }))
      const res = await fetch("/api/supplier/ai-product-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: title,
          description: notes,
          imageUrls: httpsUrls.slice(0, 4),
          imageDataUrls: dataUrls,
          categoryPath: categoryPathLabel,
          characteristics,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        description?: string
        specs?: Record<string, string>
      }
      if (!res.ok) throw new Error(data.error ?? "Generation failed")
      const desc = typeof data.description === "string" ? data.description : ""
      if (!desc.trim()) throw new Error("Empty response")
      const specs =
        data.specs && typeof data.specs === "object" && !Array.isArray(data.specs)
          ? (data.specs as Record<string, string>)
          : {}

      onGenerated({
        description: desc,
        specs,
        title: title.length >= 2 ? title : undefined,
        mergeHttpsImageUrls: httpsUrls.length ? httpsUrls : undefined,
      })
      toast.success("Listing draft applied — review on the form.")
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setLoading(false)
    }
  }, [
    modalTitle,
    modalNotes,
    urlField,
    fileSlots,
    categoryPathLabel,
    categoryAttrs,
    onGenerated,
  ])

  return (
    <>
      <Card className="border-zinc-200 bg-zinc-50/90 p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-zinc-950">
            <Sparkles className="h-5 w-5 text-zinc-800 dark:text-zinc-100" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Publication assistée</h2>
              <Badge
                variant="secondary"
                className="border border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100"
              >
                New
              </Badge>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Open the assistant, add your notes and photos, then generate a full listing draft.
            </p>
            <Button type="button" size="sm" onClick={openDialog}>
              Ouvrir l’assistant
            </Button>
          </div>
        </div>
      </Card>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            className="max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" aria-hidden />
                <h2 id={`${dialogId}-title`} className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  Assistant fiche produit
                </h2>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div>
                <Label htmlFor={`${dialogId}-title-input`}>Working title</Label>
                <Input
                  id={`${dialogId}-title-input`}
                  className="mt-1.5"
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="Product name"
                  maxLength={500}
                />
              </div>
              <div>
                <Label htmlFor={`${dialogId}-notes`}>Notes produit</Label>
                <textarea
                  id={`${dialogId}-notes`}
                  className="mt-1.5 min-h-[100px] w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Materials, variants, audience, differentiators…"
                />
              </div>
              <div>
                <Label htmlFor={`${dialogId}-urls`}>Image URLs (optional)</Label>
                <p className="mt-0.5 text-xs text-zinc-500">One https URL per line.</p>
                <textarea
                  id={`${dialogId}-urls`}
                  className="mt-1.5 min-h-[72px] w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 font-mono text-xs dark:border-zinc-700"
                  value={urlField}
                  onChange={(e) => setUrlField(e.target.value)}
                  placeholder={"https://…"}
                />
              </div>
              <div>
                <Label htmlFor={fileInputId}>Upload photos (optional)</Label>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Up to {MAX_UPLOAD_SLOTS} images — compressed for the model (not stored until you save the product).
                </p>
                <input
                  id={fileInputId}
                  type="file"
                  accept="image/*"
                  multiple
                  className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
                  disabled={loading || fileBusy || fileSlots.length >= MAX_UPLOAD_SLOTS}
                  onChange={(e) => void onPickFiles(e)}
                />
                {fileSlots.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {fileSlots.map((s) => (
                      <li
                        key={s.id}
                        className="relative h-16 w-16 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700"
                      >
                        {/* data: URLs — next/image not suitable */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.dataUrl} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white"
                          onClick={() => removeSlot(s.id)}
                          aria-label={`Remove ${s.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {categoryPathLabel ? (
                <p className="text-xs text-zinc-500">
                  Category context: <span className="text-zinc-700 dark:text-zinc-300">{categoryPathLabel}</span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <Button type="button" variant="outline" disabled={loading} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={loading} onClick={() => void submitModal()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Generating…
                  </>
                ) : (
                  "Générer"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
