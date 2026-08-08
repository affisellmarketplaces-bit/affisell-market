"use client"
import { useState, useMemo } from "react"

const CHART = [
  { eu: 35, us_m: 3, us_w: 4.5, uk: 2.5, cm: 22.1, mp: 221 },
  { eu: 36, us_m: 4, us_w: 5.5, uk: 3.5, cm: 22.9, mp: 229 },
  { eu: 37, us_m: 4.5, us_w: 6, uk: 4, cm: 23.3, mp: 233 },
  { eu: 38, us_m: 5.5, us_w: 7, uk: 5, cm: 24.1, mp: 241 },
  { eu: 39, us_m: 6.5, us_w: 8, uk: 6, cm: 24.8, mp: 248 },
  { eu: 40, us_m: 7, us_w: 8.5, uk: 6.5, cm: 25.4, mp: 254 },
  { eu: 41, us_m: 8, us_w: 9.5, uk: 7.5, cm: 26.0, mp: 260 },
  { eu: 42, us_m: 8.5, us_w: 10, uk: 8, cm: 26.7, mp: 267 },
  { eu: 43, us_m: 9.5, us_w: 11, uk: 9, cm: 27.3, mp: 273 },
  { eu: 44, us_m: 10, us_w: 11.5, uk: 9.5, cm: 28.0, mp: 280 },
  { eu: 45, us_m: 11, us_w: 12.5, uk: 10.5, cm: 28.6, mp: 286 },
  { eu: 46, us_m: 12, us_w: 13.5, uk: 11.5, cm: 29.4, mp: 294 },
  { eu: 47, us_m: 13, us_w: 14.5, uk: 12.5, cm: 30.2, mp: 302 },
  { eu: 48, us_m: 14, us_w: 15.5, uk: 13.5, cm: 31.0, mp: 310 },
]

const BRANDS: Record<string, { delta: number; note: string }> = {
  Nike: { delta: 0.5, note: "Taille petit, prends +0.5" },
  Adidas: { delta: 0, note: "Taille juste" },
  "New Balance": { delta: -0.25, note: "Taille grand, confortable" },
  Puma: { delta: 0, note: "Taille juste" },
  Converse: { delta: -0.5, note: "Taille très grand" },
  Jordan: { delta: 0.5, note: "Taille petit" },
}

export default function ShoeSizeGuide({ brand, onSelect }: { brand?: string; onSelect?: (eu: number) => void }) {
  const [cm, setCm] = useState(26)
  const [gender, setGender] = useState<"homme" | "femme" | "enfant">("homme")
  const [tab, setTab] = useState<"mesurer" | "convertir" | "marque">("mesurer")

  const brandInfo = brand? BRANDS[brand] : null
  const delta = brandInfo?.delta?? 0

  const recommended = useMemo(() => {
    const found = [...CHART].sort((a,b)=> Math.abs(a.cm - cm) - Math.abs(b.cm - cm))[0]
    if (!found) return CHART[6]
    const idx = CHART.findIndex(c=> c.eu===found.eu)
    const adjustedIdx = Math.min(CHART.length-1, Math.max(0, idx + Math.round(delta)))
    return CHART[adjustedIdx]
  }, [cm, delta])

  return (
    <div className="w-full rounded- border border-violet-200/50 bg-gradient-to-br from-white to-violet-50/60 p-5 backdrop-blur-xl shadow-[0_8px_30px_rgba(124,58,237,0.08)] mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text- font-bold tracking-tight">Guide des tailles intelligent</h3>
          <p className="text- text-zinc-500">Mesure ton pied une fois, porte la bonne pointure partout</p>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-zinc-100">
          {(["homme","femme","enfant"] as const).map(g=>(
            <button key={g} onClick={()=>setGender(g)} className={`px-3 py-1.5 text-xs rounded-full capitalize transition ${gender===g? "bg-white shadow font-semibold" : "text-zinc-500"}`}>{g}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { id:"mesurer", label:"📏 Mesurer" },
          { id:"convertir", label:"🔄 Convertir" },
          { id:"marque", label:"🏷️ Marque" },
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)} className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${tab===t.id? "bg-violet-600 text-white border-violet-600" : "bg-white border-zinc-200"}`}>{t.label}</button>
        ))}
      </div>

      {tab==="mesurer" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border p-4 flex gap-4 items-center">
            <div className="flex-1">
              <div className="text-xs text-zinc-500 mb-2">Longueur pied : <b className="text-zinc-900">{cm.toFixed(1)} cm</b></div>
              <input type="range" min={20} max={32} step={0.1} value={cm} onChange={e=>setCm(parseFloat(e.target.value))} className="w-full accent-violet-600" />
              <div className="flex justify-between text- text-zinc-400 mt-1"><span>20 cm</span><span>32 cm</span></div>
            </div>
            <div className="w- h- rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center text-white shadow-lg">
              <div className="text-center"><div className="text-2xl font-black">{recommended.eu}</div><div className="text- uppercase tracking-widest opacity-80">EU reco</div></div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-white rounded-xl border p-2"><div className="text- text-zinc-500">EU</div><div className="font-bold">{recommended.eu}</div></div>
            <div className="bg-white rounded-xl border p-2"><div className="text- text-zinc-500">US {gender==="femme"?"W":"M"}</div><div className="font-bold">{gender==="femme"?recommended.us_w:recommended.us_m}</div></div>
            <div className="bg-white rounded-xl border p-2"><div className="text- text-zinc-500">UK</div><div className="font-bold">{recommended.uk}</div></div>
            <div className="bg-white rounded-xl border p-2"><div className="text- text-zinc-500">CM</div><div className="font-bold">{recommended.cm}</div></div>
          </div>
          {brandInfo && <div className="text-xs bg-amber-50 border border-amber-200 rounded-xl p-3">⚠️ {brand} : {brandInfo.note} → reco ajustée appliquée.</div>}
          <button onClick={()=>onSelect?.(recommended.eu)} className="w-full py-3 rounded-xl bg-zinc-900 text-white text-sm font-semibold">Appliquer EU {recommended.eu} au produit</button>
        </div>
      )}

      {tab==="convertir" && (
        <div className="rounded-2xl bg-white border overflow-hidden">
          <div className="grid grid-cols-5 gap-0 bg-zinc-50 text- font-semibold text-zinc-500 p-2 px-3"><span>EU</span><span>US</span><span>UK</span><span>CM</span><span></span></div>
          <div className="max-h- overflow-auto divide-y">
            {CHART.map(r=>{
              const active = r.eu===recommended.eu
              return <div key={r.eu} className={`grid grid-cols-5 items-center px-3 py-2.5 text-sm ${active? "bg-violet-600 text-white font-bold" : ""}`}><span>{r.eu}</span><span>{gender==="femme"?r.us_w:r.us_m}</span><span>{r.uk}</span><span>{r.cm}</span><span className="text-right"><button onClick={()=>onSelect?.(r.eu)} className={`text-xs px-2 py-1 rounded-full ${active? "bg-white text-violet-600" : "bg-zinc-900 text-white"}`}>Choisir</button></span></div>
            })}
          </div>
        </div>
      )}

      {tab==="marque" && (
        <div className="space-y-2">
          {Object.entries(BRANDS).map(([name, info])=>(
            <div key={name} className={`flex items-center justify-between p-3 rounded-xl border ${brand===name? "bg-violet-600 text-white border-violet-600" : "bg-white"}`}><div className="font-semibold text-sm">{name}</div><div className={`text-xs ${brand===name? "text-violet-200" : "text-zinc-500"}`}>{info.note}</div></div><div className="text-xs font-bold">{info.delta>0? `+${info.delta}` : info.delta} EU</div></div>
          ))}
        </div>
      )}

      <div className="mt-3 text- text-zinc-500 leading-snug">💡 Astuce pro : mesure le soir, pied contre un mur, du talon au gros orteil. Ajoute 0.5 cm de confort.</div>
    </div>
  )
}
