"use client"

import { useEffect, useMemo, useState } from "react"
import { Footprints, Ruler, Sparkles, Table2, X } from "lucide-react"

import { cn } from "@/lib/utils"

type Gender = "femme" | "homme"
type ShoeSize = { eu: number; cm: number }

const FEMME_SIZES: ShoeSize[] = [
  { eu: 35, cm: 22.5 },
  { eu: 36, cm: 23 },
  { eu: 36.5, cm: 23.5 },
  { eu: 37, cm: 23.5 },
  { eu: 37.5, cm: 24 },
  { eu: 38, cm: 24 },
  { eu: 38.5, cm: 24.5 },
  { eu: 39, cm: 25 },
  { eu: 40, cm: 25.5 },
  { eu: 40.5, cm: 26 },
  { eu: 41, cm: 26.5 },
  { eu: 42, cm: 27 },
]

const HOMME_SIZES: ShoeSize[] = [
  { eu: 39, cm: 25 },
  { eu: 40, cm: 25.5 },
  { eu: 40.5, cm: 26 },
  { eu: 41, cm: 26.5 },
  { eu: 41.5, cm: 27 },
  { eu: 42, cm: 27 },
  { eu: 42.5, cm: 27.5 },
  { eu: 43, cm: 28 },
  { eu: 44, cm: 28.5 },
  { eu: 44.5, cm: 29 },
  { eu: 45, cm: 29.5 },
  { eu: 46, cm: 30 },
]

function getShoeSizes(gender: Gender) {
  return gender === "femme" ? FEMME_SIZES : HOMME_SIZES
}

type Props = {
  brand?: string
  gender?: Gender
  selectedEU?: number
  onSelect?: (eu: number) => void
  className?: string
  onClose?: () => void
}

export default function ShoeSizeGuide({
  brand: _brand,
  gender: initialGender = "femme",
  selectedEU,
  onSelect,
  className,
  onClose,
}: Props) {
  const [gender, setGender] = useState<Gender>(initialGender)
  const [mode, setMode] = useState<"measure" | "table">("measure")
  const [cm, setCm] = useState("")

  const sizes = useMemo(() => getShoeSizes(gender), [gender])

  const suggested = useMemo(() => {
    if (!cm) return null
    const num = parseFloat(cm.replace(",", "."))
    if (isNaN(num)) return null
    let best = sizes[0]
    let diff = Infinity
    for (const s of sizes) {
      const d = Math.abs(s.cm - num)
      if (d < diff) {
        diff = d
        best = s
      }
    }
    return best
  }, [cm, sizes])

  const handleSelect = (eu: number) => {
    onSelect?.(eu)
    onClose?.()
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden border border-violet-200/50 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:border-violet-800/30 dark:bg-zinc-900 dark:shadow-black/40",
        onClose
          ? "rounded-t-2xl border-x-0 border-b-0 sm:rounded-2xl sm:border-x sm:border-b"
          : "rounded-2xl",
        className
      )}
    >
      <div className="relative bg-[#0A0A0F] px-5 py-5 sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-600/35 via-fuchsia-500/15 to-transparent" />
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le guide des tailles"
            className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
          >
            <X className="size-4" />
          </button>
        ) : null}

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 pr-10 sm:pr-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1">
              <Sparkles className="size-3 text-violet-300" />
              <span className="text-[10px] font-medium uppercase leading-none tracking-[0.2em] text-white/70">
                Intelligent • Buyer
              </span>
            </div>
            <h3
              id="shoe-size-guide-title"
              className="mt-3 flex flex-wrap items-center gap-2 text-lg font-semibold leading-snug text-white sm:text-xl"
            >
              <span>Guide de pointure intelligent</span>
              <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                PRO
              </span>
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">
              Trouve ta pointure parfaite. Réduit les retours de 30% sur les chaussures.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["femme", "homme"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={cn(
                    "h-8 rounded-full border px-4 text-xs font-medium capitalize transition",
                    gender === g
                      ? "border-white bg-white text-black"
                      : "border-white/10 bg-white/10 text-white/70 hover:bg-white/15"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center backdrop-blur-sm sm:min-w-[7.5rem]">
            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/50">Impact</div>
            <div className="text-2xl font-bold tabular-nums text-white">-30%</div>
            <div className="text-[11px] leading-snug text-white/50">de retours chaussures</div>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 dark:bg-zinc-900 sm:p-6">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("measure")}
            className={cn(
              "flex h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition",
              mode === "measure"
                ? "border-violet-600 bg-violet-600 text-white shadow-[0_2px_12px_rgba(124,58,237,0.35)]"
                : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600"
            )}
          >
            <Ruler className="size-4" />
            <span>Mesurer mon pied</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("table")}
            className={cn(
              "flex h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition",
              mode === "table"
                ? "border-violet-600 bg-violet-600 text-white shadow-[0_2px_12px_rgba(124,58,237,0.35)]"
                : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600"
            )}
          >
            <Table2 className="size-4" />
            <span>Table complète</span>
          </button>
        </div>

        {mode === "measure" ? (
          <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
            <label
              htmlFor="shoe-size-cm-input"
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Longueur de ton pied (cm)
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="shoe-size-cm-input"
                inputMode="decimal"
                value={cm}
                onChange={(e) => setCm(e.target.value)}
                placeholder="Ex : 25,3"
                className="h-11 flex-1 rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900"
              />
              {cm ? (
                <button
                  type="button"
                  onClick={() => setCm("")}
                  aria-label="Effacer la mesure"
                  className="flex size-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:text-zinc-100"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
            {suggested ? (
              <div className="mt-3 flex flex-col gap-2 rounded-xl border border-violet-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-violet-800 dark:bg-zinc-900">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Pointure conseillée
                </span>
                <button
                  type="button"
                  onClick={() => handleSelect(suggested.eu)}
                  className="h-9 rounded-full bg-violet-600 px-4 text-xs font-semibold text-white transition hover:bg-violet-700"
                >
                  EU {suggested.eu} · {suggested.cm} cm
                </button>
              </div>
            ) : null}
            <p className="mt-3 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Mesure talon contre mur, le soir. Ajoute 0,5 cm de confort.
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Sélectionne une pointure pour l&apos;appliquer au produit.
            </p>
            <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
              {sizes.map((s) => (
                <button
                  key={s.eu}
                  type="button"
                  onClick={() => handleSelect(s.eu)}
                  className={cn(
                    "flex h-12 flex-col items-center justify-center rounded-xl border text-xs font-medium leading-none transition",
                    selectedEU === s.eu
                      ? "border-violet-600 bg-violet-600 text-white shadow-[0_2px_10px_rgba(124,58,237,0.3)]"
                      : "border-zinc-200 bg-white text-zinc-800 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-violet-700"
                  )}
                >
                  <span>EU {s.eu}</span>
                  <span className={cn("mt-0.5 text-[10px]", selectedEU === s.eu ? "text-white/80" : "text-zinc-500")}>
                    {s.cm} cm
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50 p-3.5 dark:border-amber-800/30 dark:bg-amber-950/20">
          <span className="text-sm leading-none" aria-hidden>
            💡
          </span>
          <p className="text-xs leading-relaxed text-amber-900/85 dark:text-amber-100/75">
            Si tu hésites entre deux pointures, prends la plus grande — le confort augmente la
            satisfaction client.
          </p>
        </div>
      </div>
    </div>
  )
}

export function ShoeSizeGuideTrigger(props: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/80 px-2.5 py-1 text-[11px] font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100 dark:border-violet-800/50 dark:bg-violet-950/30 dark:text-violet-300 dark:hover:bg-violet-950/50"
      >
        <Footprints className="size-3.5" />
        Guide des tailles
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 bg-zinc-950/65 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shoe-size-guide-title"
            className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain sm:max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ShoeSizeGuide {...props} onClose={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  )
}
