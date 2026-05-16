"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  CategoryAttributeFields,
  mergeCoreCategoryAttrs,
  missingRequiredCategorySpecs,
  type CategoryAttrRow,
} from "@/components/supplier/category-attribute-fields"
import type { CategoryAttributeDto } from "@/lib/category-attribute-api"
import {
  filterVisibleCategoryAttributes,
  pruneHiddenCategoryAttributeValues,
} from "@/lib/category-attribute-rules"

function dtoToRow(d: CategoryAttributeDto): CategoryAttrRow {
  return {
    id: d.id,
    key: d.key,
    label: d.label,
    type: d.type,
    unit: d.unit,
    options: d.options,
    required: d.required,
    order: d.order,
    recommended: d.recommended,
    validationRule: d.validationRule,
    dependsOnKey: d.dependsOnKey,
    dependsOnValue: d.dependsOnValue,
    helpText: d.helpText,
  }
}

type Props = {
  categoryId: string
  values: Record<string, string>
  onChange: (next: Record<string, string>) => void
  className?: string
}

/**
 * Amazon-style specs block: fields load from taxonomy when `categoryId` changes.
 * Persist values via parent state; on submit map to `productAttributes` [{ key, label, value }].
 */
export function DynamicAttributes({ categoryId, values, onChange, className }: Props) {
  const [attrs, setAttrs] = useState<CategoryAttrRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!categoryId.trim()) {
      setAttrs([])
      return
    }
    setLoading(true)
    fetch(`/api/categories/${encodeURIComponent(categoryId.trim())}/attributes`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const j = (await r.json()) as { attributes?: CategoryAttributeDto[] } | CategoryAttributeDto[]
        if (cancelled) return
        const list = Array.isArray(j) ? j : Array.isArray(j.attributes) ? j.attributes : []
        setAttrs(list.map(dtoToRow))
      })
      .catch(() => {
        if (!cancelled) setAttrs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [categoryId])

  const merged = useMemo(() => mergeCoreCategoryAttrs(attrs), [attrs])
  const visibleAttrs = useMemo(
    () => filterVisibleCategoryAttributes(merged, values),
    [merged, values]
  )

  const handleChange = useCallback(
    (next: Record<string, string>) => {
      onChange(pruneHiddenCategoryAttributeValues(merged, next))
    },
    [merged, onChange]
  )

  if (!categoryId.trim()) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Pick a category to see specification fields for this aisle.
      </p>
    )
  }

  return (
    <div className={className}>
      <CategoryAttributeFields
        attributes={visibleAttrs}
        loading={loading}
        values={values}
        onChange={handleChange}
      />
    </div>
  )
}

export { missingRequiredCategorySpecs, mergeCoreCategoryAttrs }
