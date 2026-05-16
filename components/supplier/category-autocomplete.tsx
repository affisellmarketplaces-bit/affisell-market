"use client"

import { useMemo } from "react"
import Select, { type GroupBase, type SingleValue, type StylesConfig } from "react-select"

import type { BrowsePayload } from "@/components/supplier/supplier-category-picker"
import { pathFromLeafId, type CategoryPathSegment } from "@/lib/category-browse"

export type CategorySelectOption = {
  value: string
  label: string
}

type Props = {
  browse: BrowsePayload | null
  value: string
  onChange: (leafId: string, path: CategoryPathSegment[]) => void
  disabled?: boolean
  placeholder?: string
}

const selectStyles: StylesConfig<CategorySelectOption, false, GroupBase<CategorySelectOption>> = {
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: state.isFocused ? "var(--ring)" : "var(--border)",
    boxShadow: state.isFocused ? "0 0 0 1px var(--ring)" : "none",
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
    ":hover": { borderColor: state.isFocused ? "var(--ring)" : "var(--border)" },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 50,
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    boxShadow: "0 10px 40px rgb(0 0 0 / 0.12)",
  }),
  menuList: (base) => ({ ...base, maxHeight: 280 }),
  option: (base, state) => ({
    ...base,
    fontSize: 12,
    lineHeight: 1.35,
    cursor: "pointer",
    color: state.isSelected ? "var(--primary-foreground)" : "var(--popover-foreground)",
    backgroundColor: state.isSelected
      ? "var(--accent)"
      : state.isFocused
        ? "var(--muted)"
        : "var(--popover)",
  }),
  singleValue: (base) => ({ ...base, fontSize: 13, color: "var(--foreground)" }),
  placeholder: (base) => ({ ...base, fontSize: 13, color: "var(--muted-foreground)" }),
  input: (base) => ({ ...base, fontSize: 13, color: "var(--foreground)" }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
}

export function CategoryAutocomplete({
  browse,
  value,
  onChange,
  disabled,
  placeholder = "Rechercher dans la taxonomie Google (FR)…",
}: Props) {
  const options = useMemo<CategorySelectOption[]>(() => {
    if (!browse) return []
    return browse.leafPaths.map((lp) => ({ value: lp.leafId, label: lp.breadcrumb }))
  }, [browse])

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  )

  const handleChange = (opt: SingleValue<CategorySelectOption>) => {
    if (!opt || !browse) return
    const path = pathFromLeafId(opt.value, browse.nodes)
    if (path?.length) onChange(opt.value, path)
  }

  if (!browse || browse.leafPaths.length === 0) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Chargement des catégories feuilles…
      </p>
    )
  }

  return (
    <Select<CategorySelectOption, false>
      instanceId="affisell-category-google-fr"
      isDisabled={disabled}
      isClearable
      isSearchable
      placeholder={placeholder}
      noOptionsMessage={({ inputValue }) =>
        inputValue.trim() ? "Aucune catégorie correspondante." : "Tapez pour filtrer parmi les feuilles."
      }
      options={options}
      value={selected}
      onChange={handleChange}
      styles={selectStyles}
      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
      menuPosition="fixed"
      filterOption={(candidate, raw) => {
        const q = raw.toLowerCase().trim()
        if (!q) return true
        const label = String(candidate.label).toLowerCase()
        return label.includes(q)
      }}
    />
  )
}
