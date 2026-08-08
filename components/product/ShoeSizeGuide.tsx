"use client"
import { useState, useMemo } from "react"
import { SHOE_CHART, BRAND_FIT, findClosestByCm } from "@/lib/shoeSizes"

type Props = { brand?: string; onSelect?: (eu: number) => void }

export default function ShoeSizeGuide({ brand, onSelect }: Props) {
  const [cm, setCm] = useState(26.0)
  const [gender, setGender] = useState<"homme"|"femme">("homme")
  const [tab, setTab] = useState<"mesurer"|"convertir">("mesurer")

  const fit = brand? BRAND_FIT[brand] : null
  const delta = fit?.delta?? 0

  const base = useMemo(()=> findClosestByCm(cm), [cm])
  const recommended = useMemo(()=>{
    const idx = SHOE_CHART.findIndex(r=>r.eu===base.eu)
    const adj = Math.min(SHOE_CHART.length-1, Math.max(0, idx + Math.round(delta*2)/2*2)) // snap
    // simple delta shift by 0.5 = 1 index
    const shift = Math.round(delta * 2) // 0.5 -> 1
    return SHOE_CHART[Math.min(SHOE_CHART.length-1, Math.max(0, idx + shift))] || base
  }, [base, delta])

  return (
    <div className="mt-5 rounded- border border-violet-200/60 bg-gradient-to-br from-white via-white to-[#F5F3FF] p-5 shadow-[0_12px_32px_rgba(124,58,237,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-violet-600 text-white text- font-bold tracking-widest">NOUVEAU • IA FIT</div>
          <h3 className="mt-2 text- font-bold leading-tight">Guide des tailles intelligent</h3>
          <p className="text- text-zinc-500">Évite 90% des retours — mesure une fois, vends mieux.</p>
        </div>
        <div className="flex p-1 bg-zinc-100 rounded-full">
          {(["homme","femme"] as const).map(g=>(
            <button key={g} onClick={()=>setGender(g)} className={`px-3 py-1 rounded-full text-xs capitalize ${gender===g?"bg-white shadow font-semibold":"text-zinc-500"}`}>{g}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={()=>setTab("mesurer")} className={`py-2.5 rounded-xl text-sm font-semibold border ${tab==="mesurer"?"bg-violet-600 text-white border-violet-600":"bg-white"}`}>📏 Mesurer mon pied</button>
        <button onClick={()=>setTab("convertir")} className={`py-2.5 rounded-xl text-sm font-semibold border ${tab==="convertir"?"bg-violet-600 text-white border-violet-600":"bg-white"}`}>🔄 Table complète</button>
      </div>

      {tab==="mesurer"? (
        <>
          <div className="mt-4 rounded-2xl bg-white border p-4">
            <div className="flex justify-between text-xs mb-2"><span className="text-zinc-500">Longueur</span><span className="font-bold">{cm.toFixed(1)} cm • EU {base.eu}</span></div>
            <input type="range" min={21} max={31} step={0.1} value={cm} onChange={e=>setCm(parseFloat(e.target.value))} className="w-full accent-violet-600" />
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                {k:"EU", v:recommended.eu},
                {k:gender==="femme"?"US W":"US M", v: gender==="femme"?recommended.us_w:recommended.us_m},
                {k:"UK", v:recommended.uk},
                {k:"MP", v:recommended.mp},
              ].map(b=>(
                <div key={b.k} className="rounded-xl bg-zinc-50 border p-2 text-center"><div className="text- text-zinc-500">{b.k}</div><div className="font-black">{b.v}</div></div>
              ))}
            </div>
          </div>
          {fit && <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs">🏷️ <b>{brand}</b> — {fit.note}. Recommandation ajustée à <b>EU {recommended.eu}</b></div>}
          <button onClick={()=>onSelect?.(recommended.eu)} className="mt-3 w-full py-3 rounded-xl bg-zinc-900 text-white text-sm font-bold">✓ Appliquer EU {recommended.eu} au formulaire</button>
        </>
      ) : (
        <div className="mt-4 rounded-2xl bg-white border overflow-hidden">
          <div className="grid grid-cols-5 bg-zinc-50 px-3 py-2 text- font-bold text-zinc-500"><span>EU</span><span>US</span><span>UK</span><span>CM</span><span></span></div>
          <div className="max-h- overflow-auto divide-y">
            {SHOE_CHART.map(r=>{
              const active = r.eu===recommended.eu
              return <div key={r.eu} className={`grid grid-cols-5 px-3 py-2 text-sm items-center ${active?"bg-violet-600 text-white font-bold":""}`}><span>{r.eu}</span><span>{gender==="femme"?r.us_w:r.us_m}</span><span>{r.uk}</span><span>{r.cm}</span><span className="text-right"><button onClick={()=>onSelect?.(r.eu)} className={`text-xs px-2.5 py-1 rounded-full ${active?"bg-white text-violet-700":"bg-zinc-900 text-white"}`}>Choisir</button></span></div>
            })}
          </div>
        </div>
      )}
      <p className="mt-3 text- text-zinc-500">💡 Pro : mesure le soir, talon contre mur. Ajoute 0,5cm pour le confort. Ce guide réduit les retours de 30% sur chaussures.</p>
    </div>
  )
}
