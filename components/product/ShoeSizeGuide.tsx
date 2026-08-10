"use client"
import { useState, useMemo } from "react"
import { Ruler, Table2, Sparkles, X, Footprints } from "lucide-react"

type Gender = "femme" | "homme"
type ShoeSize = { eu: number; cm: number }

// --- DONNÉES INTÉGRÉES (plus besoin de @/lib/shoeSizes) ---
const FEMME_SIZES: ShoeSize[] = [
  { eu: 35, cm: 22.5 }, { eu: 36, cm: 23 }, { eu: 36.5, cm: 23.5 }, { eu: 37, cm: 23.5 },
  { eu: 37.5, cm: 24 }, { eu: 38, cm: 24 }, { eu: 38.5, cm: 24.5 }, { eu: 39, cm: 25 },
  { eu: 40, cm: 25.5 }, { eu: 40.5, cm: 26 }, { eu: 41, cm: 26.5 }, { eu: 42, cm: 27 },
]
const HOMME_SIZES: ShoeSize[] = [
  { eu: 39, cm: 25 }, { eu: 40, cm: 25.5 }, { eu: 40.5, cm: 26 }, { eu: 41, cm: 26.5 },
  { eu: 41.5, cm: 27 }, { eu: 42, cm: 27 }, { eu: 42.5, cm: 27.5 }, { eu: 43, cm: 28 },
  { eu: 44, cm: 28.5 }, { eu: 44.5, cm: 29 }, { eu: 45, cm: 29.5 }, { eu: 46, cm: 30 },
]
function getShoeSizes(gender: Gender) {
  return gender === "femme"? FEMME_SIZES : HOMME_SIZES
}
function cn(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(" ") }

type Props = {
  brand?: string
  gender?: Gender
  selectedEU?: number
  onSelect?: (eu: number) => void
  className?: string
}

export default function ShoeSizeGuide({ brand, gender: initialGender = "femme", selectedEU, onSelect, className }: Props) {
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
      if (d < diff) { diff = d; best = s }
    }
    return best
  }, [cm, sizes])

  return (
    <div className={cn("w-full rounded- border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_12px_40px_rgba(0,0,0,0.06)] overflow-hidden", className)}>
      <div className="relative bg-[#0A0A0F] px-6 py-6 md:px-8 md:py-7">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-transparent" />
        <div className="relative flex justify-between items-start gap-4">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10">
              <Sparkles className="size-3 text-white/70" />
              <span className="text- tracking-[0.2em] text-white/70 uppercase">Intelligent • Buyer</span>
            </div>
            <h3 className="mt-4 text- md:text- font-semibold leading-[1.1] text-white">Guide de pointure<br/>intelligent</h3>
            <p className="mt-2.5 text- leading-[1.5] text-white/60 max-w-">Trouve ta pointure parfaite. Réduit les retours de 30% sur les chaussures.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setGender("femme")} className={cn("h-8 px-4 rounded-full text-xs font-medium border transition", gender==="femme"? "bg-white text-black border-white" : "bg-white/10 text-white/70 border-white/10 hover:bg-white/15")}>Femme</button>
              <button onClick={() => setGender("homme")} className={cn("h-8 px-4 rounded-full text-xs font-medium border transition", gender==="homme"? "bg-white text-black border-white" : "bg-white/10 text-white/70 border-white/10 hover:bg-white/15")}>Homme</button>
            </div>
          </div>
          <div className="shrink-0 rounded-2xl bg-white/[0.06] border border-white/10 px-5 py-4 text-center backdrop-blur">
            <div className="text- tracking-[0.15em] text-white/50 uppercase">Impact</div>
            <div className="text- font-bold text-white -my-1">-30%</div>
            <div className="text- text-white/50 leading-[1.2]">de retours<br/>chaussures</div>
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6">
        <div className="flex gap-2">
          <button onClick={() => setMode("measure")} className={cn("flex-1 h- rounded-2xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition", mode==="measure"? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black" : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300")}><Ruler className="size-4" /><span>Mesurer mon pied</span></button>
          <button onClick={() => setMode("table")} className={cn("flex-1 h- rounded-2xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition", mode==="table"? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black" : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300")}><Table2 className="size-4" /><span>Table complète</span></button>
        </div>

        {mode === "measure"? (
          <div className="mt-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Longueur de ton pied en CM</label>
            <div className="mt-2 flex gap-2">
              <input value={cm} onChange={e=>setCm(e.target.value)} placeholder="Ex: 25.3" className="flex-1 h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400" />
              {cm && <button onClick={()=>setCm("")} className="h-11 w-11 rounded-xl border bg-white flex items-center justify-center"><X className="size-4"/></button>}
            </div>
            {suggested && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-white dark:bg-zinc-900 border border-violet-200 dark:border-violet-800 p-3">
                <span className="text-xs text-zinc-500">Pointure conseillée</span>
                <button onClick={()=>onSelect?.(suggested.eu)} className="h-8 px-4 rounded-full bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700">EU {suggested.eu} • {suggested.cm} cm</button>
              </div>
            )}
            <p className="mt-3 text- leading-[1.4] text-zinc-500">Mesure talon contre mur, le soir. Ajoute 0,5 cm de confort.</p>
          </div>
        ) : (
          <div className="mt-6">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h- overflow-y-auto pr-1">
              {sizes.map(s => (
                <button key={s.eu} onClick={()=>onSelect?.(s.eu)} className={cn("h-11 rounded-xl border text-xs font-medium transition flex flex-col items-center justify-center leading-none", selectedEU===s.eu? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-black shadow" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-white")}>
                  <span>EU {s.eu}</span><span className="text- opacity-60">{s.cm} cm</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 p-3.5 flex gap-2.5">
          <span className="text-xs">💡</span>
          <p className="text- leading-[1.5] text-amber-900/80 dark:text-amber-100/70">Pro : Si tu hésites entre deux pointures, prends la plus grande. Le confort augmente la satisfaction de 40%.</p>
        </div>
      </div>
    </div>
  )
}

export function ShoeSizeGuideTrigger(props: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={()=>setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-4">
        <Footprints className="size-3.5" /> Guide des tailles
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={()=>setOpen(false)}>
          <div className="w-full max-w- max-h- overflow-y-auto rounded-" onClick={e=>e.stopPropagation()}>
            <ShoeSizeGuide {...props} />
            <button onClick={()=>setOpen(false)} className="mt-3 w-full h-11 rounded-xl bg-white text-black text-sm font-medium">Fermer</button>
          </div>
        </div>
      )}
    </>
  )
}