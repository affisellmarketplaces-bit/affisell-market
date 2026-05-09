"use client"

import { Loader2, Upload, X } from "lucide-react"
import type { ChangeEvent, CSSProperties } from "react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { measureImageFile, processProductImageToDataUrl } from "@/lib/product-image-upload"
import { cn } from "@/lib/utils"

const SLOT_COUNT = 9 /** 1 principale + 8 emplacements */

type Props = {
  onImagesChange: (urls: string[]) => void
  initialUrls?: string[]
}

function slotsToOrderedUrls(slots: (string | null)[]): string[] {
  return slots.reduce<string[]>((acc, u) => {
    if (u) acc.push(u)
    return acc
  }, [])
}

function BoxPlaceholder({ variant }: { variant: number }) {
  const stroke = "stroke-zinc-400 dark:stroke-zinc-500"
  const common = cn("h-9 w-9 shrink-0", stroke)
  switch (variant % 8) {
    case 0:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M8 14h24v20H8zM8 14l12-6 12 6" />
          <path d="M20 8v26" />
        </svg>
      )
    case 1:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M10 28L22 10l12 8-10 14z" />
          <path d="M22 10v22" />
        </svg>
      )
    case 2:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M6 16h28v18H6z" />
          <path d="M6 16l14-8 14 8" />
          <path d="M12 16v4h16" />
        </svg>
      )
    case 3:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M10 12h20v22H10z" />
          <path d="M10 18h20M10 24h12" />
        </svg>
      )
    case 4:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M14 10h16v22H8V16z" />
          <path d="M14 10v6h16" />
        </svg>
      )
    case 5:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <ellipse cx="20" cy="22" rx="14" ry="6" />
          <path d="M8 22V14l12-6 12 6v8" />
        </svg>
      )
    case 6:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <circle cx="22" cy="16" r="7" />
          <path d="M12 30c2-6 8-10 16-10" />
          <path d="M8 14h24v20H8z" opacity="0.35" />
        </svg>
      )
    default:
      return (
        <svg className={common} viewBox="0 0 40 40" fill="none" strokeWidth="1.4" aria-hidden>
          <path d="M8 14h24v20H8z" />
          <path d="M10 32V18M16 32V18M22 32V18M28 32V18" />
          <path d="M6 34h28" />
        </svg>
      )
  }
}

export function SupplierProductImageUpload({ onImagesChange, initialUrls }: Props) {
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    Array.from({ length: SLOT_COUNT }, (_, i) => initialUrls?.[i] ?? null)
  )
  const [busySlot, setBusySlot] = useState<number | null>(null)

  useEffect(() => {
    const seed = initialUrls?.filter(Boolean) ?? []
    if (seed.length === 0) return
    const next = Array.from({ length: SLOT_COUNT }, (_, i) => initialUrls?.[i] ?? null)
    setSlots(next)
    onImagesChange(slotsToOrderedUrls(next))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrls?.join("|")])

  const handleFileForSlot = async (slotIndex: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setBusySlot(slotIndex)
    try {
      const dimensions = await measureImageFile(file)
      if (dimensions.width < 800 || dimensions.height < 800) {
        toast.error(`${file.name} : minimum 800×800 px requis.`)
        return
      }
      const processed = await processProductImageToDataUrl(file)
      setSlots((prev) => {
        const next = [...prev]
        next[slotIndex] = processed
        onImagesChange(slotsToOrderedUrls(next))
        return next
      })
      toast.success(`Image ajoutée (${file.name})`)
    } catch {
      toast.error("Impossible de traiter l’image.")
    } finally {
      setBusySlot(null)
    }
  }

  const removeAt = (slotIndex: number) => {
    setSlots((prev) => {
      const next = [...prev]
      next[slotIndex] = null
      onImagesChange(slotsToOrderedUrls(next))
      return next
    })
  }

  const cellVars: CSSProperties = {
    ["--cell" as string]: "min(5.25rem, 22vw)",
    ["--g" as string]: "0.5rem",
    ["--main" as string]: "calc(2 * var(--cell) + var(--g))",
  }

  return (
    <div className="flex flex-wrap items-start gap-3" style={cellVars}>
      {/* Principale : hauteur = 2 rangées + gap */}
      <div
        className="relative shrink-0"
        style={{ width: "var(--main)", height: "var(--main)", minWidth: "var(--main)" }}
      >
        {slots[0] ? (
          <div className="relative h-full w-full overflow-hidden rounded-lg border border-zinc-200 bg-[#f4f4f5] dark:border-zinc-700 dark:bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slots[0]} alt="" className="h-full w-full object-contain p-2" />
            <button
              type="button"
              onClick={() => removeAt(0)}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600"
              aria-label="Retirer l’image principale"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50/90 transition hover:border-violet-400 hover:bg-violet-50/60 dark:border-zinc-600 dark:bg-zinc-900/50 dark:hover:border-violet-500">
            {busySlot === 0 ? (
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
            ) : (
              <>
                <Upload className="h-8 w-8 text-zinc-400" aria-hidden />
                <span className="px-2 text-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Importer l’image principale
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busySlot !== null}
              onChange={(e) => void handleFileForSlot(0, e)}
            />
          </label>
        )}
      </div>

      <div
        className="grid shrink-0 grid-cols-4 grid-rows-2 gap-2"
        style={{
          width: "calc(4 * var(--cell) + 3 * var(--g))",
          height: "var(--main)",
          gridTemplateColumns: "repeat(4, var(--cell))",
          gridTemplateRows: "repeat(2, var(--cell))",
        }}
      >
        {Array.from({ length: 8 }, (_, idx) => {
          const slotIndex = idx + 1
          const url = slots[slotIndex]
          return (
            <div key={slotIndex} className="relative min-h-0 min-w-0">
              {url ? (
                <div className="relative h-full w-full overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-contain p-1" />
                  <button
                    type="button"
                    onClick={() => removeAt(slotIndex)}
                    className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    aria-label="Retirer l’image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-md bg-zinc-100 transition hover:bg-zinc-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700/80">
                  {busySlot === slotIndex ? (
                    <Loader2 className="h-5 w-5 animate-spin text-violet-600" aria-hidden />
                  ) : (
                    <BoxPlaceholder variant={idx} />
                  )}
                  <span className="sr-only">Ajouter une image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={busySlot !== null}
                    onChange={(e) => void handleFileForSlot(slotIndex, e)}
                  />
                </label>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
