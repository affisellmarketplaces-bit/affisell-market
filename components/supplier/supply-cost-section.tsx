"use client"

import { Lock } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SUPPLY_SOURCES, type StoredDeclaration, type SupplySource } from "@/lib/supplier-costs/declaration"
import { centsToEuroText, eurosToCents } from "@/lib/supplier-costs/euro-input"

type View = { current: StoredDeclaration | null; history: Array<StoredDeclaration & { n: number }>; warnings: string[] }

/**
 * The supplier's CONFIDENTIAL supply cost for one saved product (lib/supplier-costs/declaration.ts). Kept apart from
 * the selling price and the commission: saving it changes nothing on the listing.
 */
export function SupplyCostSection({ productId }: { productId: string }) {
  const t = useTranslations("supplier.supplyCost")
  const [view, setView] = useState<View | null>(null)
  const [unit, setUnit] = useState("")
  const [delivery, setDelivery] = useState("")
  const [source, setSource] = useState<SupplySource>("own_stock")
  const [lead, setLead] = useState("")
  const [moq, setMoq] = useState("")
  const [note, setNote] = useState("")
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error" | "invalid">("idle")

  const url = `/api/supplier/products/${encodeURIComponent(productId)}/supply-cost`
  const load = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return
    const v = (await res.json()) as View
    setView(v)
    if (v.current) {
      setUnit(centsToEuroText(v.current.unitCostCents))
      setDelivery(centsToEuroText(v.current.deliveryCostCents))
      setSource(v.current.source)
      setLead(v.current.leadTimeDays == null ? "" : String(v.current.leadTimeDays))
      setMoq(v.current.minimumOrderQty == null ? "" : String(v.current.minimumOrderQty))
      setNote(v.current.note)
    }
  }, [url])
  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    const unitCents = eurosToCents(unit)
    const deliveryCents = delivery.trim() === "" ? 0 : eurosToCents(delivery)
    if (unitCents === null || deliveryCents === null) {
      setState("invalid")
      return
    }
    setState("saving")
    const res = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        unitCostCents: unitCents,
        deliveryCostCents: deliveryCents,
        source,
        leadTimeDays: lead.trim() === "" ? null : Number(lead),
        minimumOrderQty: moq.trim() === "" ? null : Number(moq),
        note,
      }),
    })
    setState(res.ok ? "saved" : res.status === 400 ? "invalid" : "error")
    if (res.ok) await load()
  }

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t("confidential")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sc-unit">{t("unitCost")}</Label>
          <Input id="sc-unit" inputMode="decimal" className="mt-1.5" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <Label htmlFor="sc-delivery">{t("deliveryCost")}</Label>
          <Input id="sc-delivery" inputMode="decimal" className="mt-1.5" value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <Label htmlFor="sc-source">{t("source")}</Label>
          <select
            id="sc-source"
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value as SupplySource)}
          >
            {SUPPLY_SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`sources.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="sc-lead">{t("leadTime")}</Label>
          <Input id="sc-lead" inputMode="numeric" className="mt-1.5" value={lead} onChange={(e) => setLead(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sc-moq">{t("minimumOrder")}</Label>
          <Input id="sc-moq" inputMode="numeric" className="mt-1.5" value={moq} onChange={(e) => setMoq(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="sc-note">{t("note")}</Label>
          <Input id="sc-note" className="mt-1.5" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {view?.warnings.includes("cost_above_supplier_price") ? <p className="text-sm text-amber-700">{t("warnAbovePrice")}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void save()} disabled={state === "saving" || unit.trim() === ""}>
          {t("save")}
        </Button>
        {state === "saved" ? <span className="text-sm text-emerald-700">{t("saved")}</span> : null}
        {state === "invalid" ? <span className="text-sm text-red-700">{t("invalid")}</span> : null}
        {state === "error" ? <span className="text-sm text-red-700">{t("error")}</span> : null}
        {view?.current ? (
          <span className="text-xs text-zinc-500">{t("lastDeclared", { date: new Date(view.current.declaredAt).toLocaleDateString() })}</span>
        ) : null}
      </div>
    </div>
  )
}
