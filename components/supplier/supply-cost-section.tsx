"use client"

import { Lock } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SUPPLY_SOURCES, type StoredDeclaration, type SupplySource } from "@/lib/supplier-costs/declaration"
import { centsToEuroText, eurosToCents } from "@/lib/supplier-costs/euro-input"

type Qualification = "unverified" | "document_provided" | "verified" | "disputed" | "expired"
type Item = StoredDeclaration & { n: number; qualification: Qualification }
type View = {
  current: StoredDeclaration | null
  inForce: Item | null
  qualification: Qualification
  qualificationEvents: Array<{ state: Qualification; note: string; at: string; role: "supplier" | "admin" }>
  history: Item[]
  warnings: string[]
  variantOptions: Array<{ key: string; label: string }>
  ambiguousVariantKeys: string[]
  variants: Array<{ variantKey: string; label: string; stillOnProduct: boolean; latest: Item | null; inForce: Item | null }>
}

const PRODUCT_SCOPE = ""

function effectiveText(d: StoredDeclaration): string {
  return new Date(d.effectiveFrom ?? d.declaredAt).toLocaleDateString()
}

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
  const [docNote, setDocNote] = useState("")
  const [docState, setDocState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [scope, setScope] = useState<string>(PRODUCT_SCOPE)
  const [effectiveFrom, setEffectiveFrom] = useState("")
  // Read once, in the initialiser: `Date.now()` in the render body is impure (react-hooks/purity) and would make the
  // "takes effect later" notice flip between two renders of the same data.
  const [nowMs] = useState(() => Date.now())

  const url = `/api/supplier/products/${encodeURIComponent(productId)}/supply-cost`
  const load = useCallback(async () => {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return
    setView((await res.json()) as View)
  }, [url])
  useEffect(() => {
    void load()
  }, [load])

  // The declaration shown and qualified: the product-wide one, or the selected variant's OWN one (never another's).
  const selected: StoredDeclaration | null =
    scope === PRODUCT_SCOPE ? (view?.current ?? null) : (view?.variants.find((v) => v.variantKey === scope)?.latest ?? null)
  const selectedQualification: Qualification =
    scope === PRODUCT_SCOPE ? (view?.qualification ?? "unverified") : (view?.variants.find((v) => v.variantKey === scope)?.latest?.qualification ?? "unverified")
  useEffect(() => {
    setUnit(selected ? centsToEuroText(selected.unitCostCents) : "")
    setDelivery(selected ? centsToEuroText(selected.deliveryCostCents) : "")
    setSource(selected?.source ?? "own_stock")
    setLead(selected?.leadTimeDays == null ? "" : String(selected.leadTimeDays))
    setMoq(selected?.minimumOrderQty == null ? "" : String(selected.minimumOrderQty))
    setNote(selected?.note ?? "")
    setEffectiveFrom("")
    setState("idle")
    setDocState("idle")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refill only when the scope or the loaded data changes
  }, [scope, view])

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
        variantKey: scope === PRODUCT_SCOPE ? null : scope,
        effectiveFrom: effectiveFrom ? new Date(`${effectiveFrom}T00:00:00`).toISOString() : null,
      }),
    })
    setState(res.ok ? "saved" : res.status === 400 ? "invalid" : "error")
    if (res.ok) await load()
  }

  const reportDocument = async () => {
    setDocState("sending")
    const res = await fetch(`${url}/qualification`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: "document_provided", note: docNote, variantKey: scope === PRODUCT_SCOPE ? null : scope }),
    })
    setDocState(res.ok ? "sent" : "error")
    if (res.ok) {
      setDocNote("")
      await load()
    }
  }
  const latestAdminNote =
    scope === PRODUCT_SCOPE ? view?.qualificationEvents.find((e) => e.role === "admin" && (e.state === "disputed" || e.state === "expired")) : undefined
  const hasVariants = (view?.variantOptions.length ?? 0) > 0 || (view?.variants.length ?? 0) > 0

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t("confidential")}
      </p>
      {hasVariants ? (
        <div className="space-y-2">
          <Label htmlFor="sc-scope">{t("variants.scope")}</Label>
          <select
            id="sc-scope"
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value={PRODUCT_SCOPE}>{t("variants.wholeProduct")}</option>
            {view?.variantOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500">{scope === PRODUCT_SCOPE ? t("variants.wholeProductHint") : t("variants.variantHint")}</p>
          {(view?.ambiguousVariantKeys.length ?? 0) > 0 ? <p className="text-xs text-amber-700">{t("variants.ambiguous")}</p> : null}
        </div>
      ) : null}
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
        <div>
          <Label htmlFor="sc-effective">{t("effectiveFrom")}</Label>
          <Input id="sc-effective" type="date" className="mt-1.5" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          <p className="mt-1 text-xs text-zinc-500">{t("effectiveFromHint")}</p>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="sc-note">{t("note")}</Label>
          <Input id="sc-note" className="mt-1.5" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {selected ? (
        <div className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-sm">
            <span className="text-zinc-500">{t("qualification.label")} : </span>
            <span className="font-medium">{t(`qualification.${selectedQualification}`)}</span>
          </p>
          {Date.parse(selected.effectiveFrom ?? selected.declaredAt) > nowMs ? (
            <p className="text-xs text-zinc-500">{t("effectiveLater", { date: effectiveText(selected) })}</p>
          ) : null}
          {latestAdminNote && selectedQualification === latestAdminNote.state ? (
            <p className="text-sm text-amber-700">{latestAdminNote.note}</p>
          ) : null}
          {selectedQualification !== "verified" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("documentTitle")}</p>
              <p className="text-xs text-zinc-500">{t("documentHint")}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={docNote} maxLength={1000} onChange={(e) => setDocNote(e.target.value)} placeholder={t("documentPlaceholder")} />
                <Button type="button" variant="outline" onClick={() => void reportDocument()} disabled={docState === "sending" || docNote.trim().length < 3}>
                  {t("documentSubmit")}
                </Button>
              </div>
              {docState === "sent" ? <p className="text-sm text-emerald-700">{t("documentSent")}</p> : null}
              {docState === "error" ? <p className="text-sm text-red-700">{t("error")}</p> : null}
            </div>
          ) : null}
          <p className="text-xs text-zinc-500">{t("newDeclarationResets")}</p>
        </div>
      ) : null}
      {view?.warnings.includes("cost_above_supplier_price") ? <p className="text-sm text-amber-700">{t("warnAbovePrice")}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void save()} disabled={state === "saving" || unit.trim() === ""}>
          {t("save")}
        </Button>
        {state === "saved" ? <span className="text-sm text-emerald-700">{t("saved")}</span> : null}
        {state === "invalid" ? <span className="text-sm text-red-700">{t("invalid")}</span> : null}
        {state === "error" ? <span className="text-sm text-red-700">{t("error")}</span> : null}
        {selected ? (
          <span className="text-xs text-zinc-500">{t("lastDeclared", { date: new Date(selected.declaredAt).toLocaleDateString() })}</span>
        ) : null}
      </div>
      {view && view.variants.length > 0 ? (
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("variants.tableTitle")}</p>
          <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {view.variants.map((v) => (
              <li key={v.variantKey} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  {v.label}
                  {!v.stillOnProduct ? <span className="ml-2 text-xs text-zinc-500">({t("variants.gone")})</span> : null}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {v.inForce
                    ? `${centsToEuroText(v.inForce.unitCostCents)} € · ${t(`qualification.${v.inForce.qualification}`)}`
                    : t("variants.notInForce")}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">{t("variants.fallbackHint")}</p>
        </div>
      ) : null}
    </div>
  )
}
