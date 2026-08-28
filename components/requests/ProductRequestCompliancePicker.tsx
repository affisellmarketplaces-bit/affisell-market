"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"

import {
  getProductRequestComplianceGroups,
  PRODUCT_REQUEST_EU_COMPLIANCE_BUNDLE,
  type ProductRequestComplianceId,
} from "@/lib/product-request-types"
import { cn } from "@/lib/utils"

type ProductRequestCompliancePickerProps = {
  selected: readonly ProductRequestComplianceId[]
  onChange: (ids: ProductRequestComplianceId[]) => void
  showEuBundle?: boolean
}

export function ProductRequestCompliancePicker({
  selected,
  onChange,
  showEuBundle = false,
}: ProductRequestCompliancePickerProps) {
  const tForm = useTranslations("productRequests.reseller.form")
  const tReq = useTranslations("productRequests.compliance")

  const toggle = useCallback(
    (id: ProductRequestComplianceId) => {
      if (selected.includes(id)) {
        onChange(selected.filter((x) => x !== id))
        return
      }
      onChange([...selected, id])
    },
    [onChange, selected]
  )

  const applyEuBundle = useCallback(() => {
    const merged = new Set([...selected, ...PRODUCT_REQUEST_EU_COMPLIANCE_BUNDLE])
    onChange([...merged])
  }, [onChange, selected])

  const clearAll = useCallback(() => onChange([]), [onChange])

  const groups = getProductRequestComplianceGroups()

  return (
    <fieldset className="rounded-xl border border-zinc-200 bg-white p-3">
      <legend className="px-1 text-xs font-semibold text-zinc-700">
        {tForm("complianceLabel")}
      </legend>
      <p className="mt-0.5 text-[11px] text-zinc-500">{tForm("complianceHint")}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {showEuBundle ? (
          <button
            type="button"
            onClick={applyEuBundle}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            {tForm("complianceEuBundle")}
          </button>
        ) : null}
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            {tForm("complianceClear")}
          </button>
        ) : null}
      </div>
      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
              {tReq(`groups.${group.id}`)}
            </p>
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
              {group.ids.map((id) => {
                const checked = selected.includes(id)
                return (
                  <label
                    key={id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition",
                      checked
                        ? "border-violet-400 bg-violet-50/80"
                        : "border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50/80"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      onChange={() => toggle(id)}
                    />
                    <span>
                      <span className="font-semibold text-zinc-900">{tReq(`${id}.title`)}</span>
                      <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
                        {tReq(`${id}.hint`)}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {selected.length > 0 ? (
        <p className="mt-3 text-[11px] font-medium text-violet-700">
          {tForm("complianceSelected", { count: selected.length })}
        </p>
      ) : null}
    </fieldset>
  )
}
