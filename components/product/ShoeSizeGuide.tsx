"use client"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { SHOE_CHART, BRAND_FIT, findClosestByCm } from "@/lib/shoeSizes"

type Props = {
  brand?: string
  onSelect?: (eu: number) => void
}

export default function ShoeSizeGuide({ brand, onSelect }: Props) {
  const [cm, setCm] = useState(26.0)
  const [gender, setGender] = useState<"homme" | "femme">("homme")
  const [tab, setTab] = useState<"mesurer" | "convertir">("mesurer")

  const fit = brand ? BRAND_FIT[brand] : null
  const delta = fit?.delta ?? 0

  const base = useMemo(() => findClosestByCm(cm), [cm])
  const recommended = useMemo(() => {
    const idx = SHOE_CHART.findIndex((row) => row.eu === base.eu)
    const shift = Math.round(delta * 2)
    const index = Math.min(SHOE_CHART.length - 1, Math.max(0, idx + shift))
    return SHOE_CHART[index] ?? base
  }, [base, delta])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/85 shadow-[0_28px_64px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/60"
      aria-label="Guide des tailles chaussures"
    >
      <div className="bg-gradient-to-r from-slate-950 via-violet-950 to-slate-900 px-6 py-5 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              Futuriste
            </span>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight">Guide de pointure intelligent</h3>
            <p className="mt-2 max-w-2xl text-sm text-violet-200/85">
              Mesure une fois, optimise la conversion et réduit les retours de chaussures de 30&nbsp;%.
            </p>
          </div>
          <div className="rounded-[2rem] border border-white/15 bg-white/10 px-4 py-3 text-right text-sm text-violet-100 shadow-[0_18px_40px_rgba(79,70,229,0.18)] backdrop-blur-xl">
            <div className="text-[10px] uppercase tracking-[0.22em] text-violet-200">Impact</div>
            <div className="mt-2 text-2xl font-bold">-30%</div>
            <div className="text-[11px] text-violet-200/80">de retours sur chaussures</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6 sm:p-7">
        <div className="grid gap-2 sm:grid-cols-2">
          {(["homme", "femme"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setGender(option)}
              className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                gender === option
                  ? "border border-violet-400 bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
              aria-pressed={gender === option}
            >
              {option === "homme" ? "Homme" : "Femme"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTab("mesurer")}
            className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
              tab === "mesurer"
                ? "bg-violet-600 text-white"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            }`}
          >
            📏 Mesurer mon pied
          </button>
          <button
            type="button"
            onClick={() => setTab("convertir")}
            className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
              tab === "convertir"
                ? "bg-violet-600 text-white"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            }`}
          >
            🔄 Table complète
          </button>
        </div>

        {tab === "mesurer" ? (
          <div className="space-y-4">
            <div className="rounded-[2rem] border border-violet-200/60 bg-zinc-50/90 p-5 shadow-lg shadow-violet-100/20 dark:border-violet-500/20 dark:bg-zinc-950/70">
              <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
                <span>Longueur du pied</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{cm.toFixed(1)} cm • EU {base.eu}</span>
              </div>
              <input
                type="range"
                min={21}
                max={31}
                step={0.1}
                value={cm}
                onChange={(event) => setCm(parseFloat(event.target.value))}
                className="mt-4 w-full accent-violet-500"
                aria-label="Longueur du pied en centimètres"
              />
              <div className="mt-4 grid grid-cols-4 gap-3">
                {[
                  { label: "EU", value: recommended.eu },
                  { label: gender === "femme" ? "US W" : "US M", value: gender === "femme" ? recommended.us_w : recommended.us_m },
                  { label: "UK", value: recommended.uk },
                  { label: "CM", value: recommended.mp },
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl bg-white px-3 py-4 text-center shadow-sm shadow-violet-100/50 dark:bg-zinc-900">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
                    <div className="mt-2 text-xl font-bold text-zinc-900 dark:text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {fit ? (
              <div className="rounded-[2rem] border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-100">
                <strong>{brand}</strong> — {fit.note}. Recommandation ajustée à <strong>EU {recommended.eu}</strong>.
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => onSelect?.(recommended.eu)}
              className="w-full rounded-[2rem] bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Appliquer EU {recommended.eu}
            </button>
          </div>
        ) : (
          <div className="rounded-[2rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
            <div className="grid grid-cols-5 gap-2 border-b border-zinc-200 bg-zinc-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <span>EU</span>
              <span>US</span>
              <span>UK</span>
              <span>CM</span>
              <span />
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800">
              {SHOE_CHART.map((row) => {
                const active = row.eu === recommended.eu
                return (
                  <div
                    key={row.eu}
                    className={`grid grid-cols-5 gap-2 px-4 py-3 text-sm transition ${
                      active
                        ? "bg-violet-600 text-white"
                        : "bg-white text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                    }`}
                  >
                    <span className="font-semibold">{row.eu}</span>
                    <span>{gender === "femme" ? row.us_w : row.us_m}</span>
                    <span>{row.uk}</span>
                    <span>{row.cm}</span>
                    <button
                      type="button"
                      onClick={() => onSelect?.(row.eu)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "bg-white text-violet-700"
                          : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                      }`}
                    >
                      Choisir
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-[2rem] border border-zinc-200/80 bg-zinc-50/90 px-4 py-3 text-sm leading-tight text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-950/60 dark:text-zinc-300">
          💡 Pro : mesure le soir, talon contre mur. Ajoute 0,5&nbsp;cm pour le confort. Ce guide réduit les retours de 30&nbsp;% sur chaussures.
        </div>
      </div>
    </motion.div>
  )
}
