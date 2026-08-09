"use client"
import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { SHOE_CHART, BRAND_FIT, findClosestByCm } from "@/lib/shoeSizes"

type Props = {
  brand?: string
  onSelect?: (eu: number) => void
}

const GENDER_OPTIONS = [
  { key: "homme", label: "Homme" },
  { key: "femme", label: "Femme" },
] as const

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
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/90 shadow-[0_30px_80px_rgba(15,23,42,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-zinc-950/65"
      aria-label="Guide des tailles chaussures"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),transparent_45%)]" />
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-slate-950 via-violet-950 to-slate-900 px-6 py-6 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.3em] text-violet-200/80">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Guide augmenté</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Calcul instantané</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">Fit optimisé</span>
            </div>
            <h3 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Guide pointures intelligent</h3>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-violet-200/85 sm:text-base">
              Une lecture claire, une recommandation transparente et un confort prévisible pour réduire les retours et renforcer la confiance d'achat.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/10 px-5 py-4 text-right text-sm text-violet-100 shadow-[0_18px_40px_rgba(79,70,229,0.16)] backdrop-blur-xl">
            <div className="text-[10px] uppercase tracking-[0.24em] text-violet-200">Impact estimé</div>
            <div className="mt-3 text-3xl font-semibold">-30%</div>
            <div className="text-xs text-violet-200/80">moins de retours sur les chaussures</div>
          </div>
        </div>
      </div>

      <div className="relative p-6 sm:p-7">
        <div className="grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setGender(option.key)}
                className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                  gender === option.key
                    ? "border border-violet-400 bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                    : "border border-zinc-200 bg-white text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                }`}
                aria-pressed={gender === option.key}
              >
                {option.label}
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
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_0.95fr]">
          <div className="space-y-5 rounded-[2rem] border border-violet-200/30 bg-zinc-50/95 p-5 shadow-[0_20px_45px_rgba(99,102,241,0.12)] dark:border-violet-500/20 dark:bg-zinc-950/80">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-violet-500">Longueur exacte</p>
                <p className="mt-3 text-4xl font-semibold text-zinc-950 dark:text-white">{cm.toFixed(1)} cm</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Correspond à EU {base.eu}</p>
              </div>
              <div className="rounded-3xl bg-white/10 px-4 py-3 text-right text-xs uppercase tracking-[0.22em] text-violet-100 shadow-sm shadow-violet-200/10 dark:bg-white/10">
                Base calculée
                <div className="mt-2 text-2xl font-bold">EU {base.eu}</div>
              </div>
            </div>

            <div className="space-y-4">
              <input
                type="range"
                min={21}
                max={31}
                step={0.1}
                value={cm}
                onChange={(event) => setCm(parseFloat(event.target.value))}
                className="h-3 w-full cursor-pointer rounded-full accent-violet-500"
                aria-label="Longueur du pied en centimètres"
              />
              <div className="grid grid-cols-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                <span>21 cm</span>
                <span>23 cm</span>
                <span className="text-center">25 cm</span>
                <span className="text-right">27 cm</span>
                <span className="text-right">31 cm</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "EU", value: recommended.eu },
                { label: gender === "femme" ? "US W" : "US M", value: gender === "femme" ? recommended.us_w : recommended.us_m },
                { label: "UK", value: recommended.uk },
                { label: "CM", value: recommended.mp },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl bg-white px-4 py-4 text-center shadow-sm shadow-violet-100/30 dark:bg-zinc-900">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
                  <div className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[2rem] border border-zinc-200/70 bg-white px-5 py-5 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">Recommandation</p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-white">EU {recommended.eu}</p>
                </div>
                <div className="rounded-3xl bg-violet-950/10 px-4 py-2 text-sm font-semibold text-violet-100 dark:bg-violet-500/15 dark:text-violet-200">
                  Ajustement {delta >= 0 ? "+" : ""}{(delta * 100).toFixed(0)} %
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                <div className="rounded-3xl bg-zinc-50 p-3 dark:bg-zinc-900">Mesure calibrée pour un confort maximal et une meilleure conversion.</div>
                {fit ? (
                  <div className="rounded-3xl border border-amber-200/80 bg-amber-50/90 p-3 text-sm text-amber-950 dark:border-amber-500/20 dark:bg-amber-950/25 dark:text-amber-100">
                    <span className="font-semibold">{brand}</span> — {fit.note}. Recommandation ajustée à <span className="font-semibold">EU {recommended.eu}</span>.
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelect?.(recommended.eu)}
              className="w-full rounded-[2rem] bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Appliquer EU {recommended.eu}
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1.5fr_0.95fr]">
          {tab === "convertir" ? (
            <div className="rounded-[2rem] border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
              <div className="grid grid-cols-5 gap-2 border-b border-zinc-200 bg-zinc-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <span>EU</span>
                <span>US</span>
                <span>UK</span>
                <span>CM</span>
                <span className="text-right">Action</span>
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
                        className={`justify-self-end rounded-full px-3 py-1 text-xs font-semibold transition ${
                          active
                            ? "bg-white text-violet-700"
                            : "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                        }`}
                      >
                        Choisir
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-[2rem] border border-zinc-200 bg-white px-5 py-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
              <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">Smart fit</span>
                <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">Conversion</span>
                <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">Confort</span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "EU recommandé", value: `EU ${recommended.eu}` },
                  { label: "US", value: gender === "femme" ? recommended.us_w : recommended.us_m },
                  { label: "UK", value: recommended.uk },
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl border border-zinc-200/80 bg-zinc-50 p-4 text-center dark:border-zinc-700/80 dark:bg-zinc-900">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">{item.label}</div>
                    <div className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[2rem] border border-zinc-200/80 bg-zinc-50/95 px-5 py-5 text-sm leading-6 text-zinc-600 shadow-sm shadow-zinc-200/30 dark:border-zinc-700/80 dark:bg-zinc-950/65 dark:text-zinc-300">
            <p className="font-semibold text-zinc-950 dark:text-white">Comment utiliser ce guide</p>
            <ul className="mt-3 space-y-3 list-disc pl-5 text-sm">
              <li>Place ton talon contre un mur et mesure jusqu’au bout de l’orteil.</li>
              <li>Utilise la valeur en centimètres et vérifie le tableau de conversion.</li>
              <li>Ajoute 0,5&nbsp;cm pour un confort assuré et des retours limités.</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
