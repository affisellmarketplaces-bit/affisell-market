"use client"

import { useCallback, useMemo } from "react"
import AsyncSelect from "react-select/async"
import type { GroupBase, SingleValue, StylesConfig } from "react-select"

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
  placeholder = "Rechercher dans le catalogue Affisell…",
}: Props) {
  const selected = useMemo((): CategorySelectOption | null => {
    if (!value || !browse) return null
    const path = pathFromLeafId(value, browse.nodes)
    if (!path?.length) return { value, label: value }
    return { value, label: path.map((p) => p.name).join(" > ") }
  }, [value, browse])

  const loadOptions = useCallback(async (inputValue: string): Promise<CategorySelectOption[]> => {
    const q = inputValue.trim()
    if (q.length < 2) return []
    const res = await fetch(`/api/categories/search?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    const data = (await res.json()) as {
      results?: Array<{ leafId: string; breadcrumb: string; path: CategoryPathSegment[] }>
    }
    return (data.results ?? []).map((r) => ({ value: r.leafId, label: r.breadcrumb }))
  }, [])

  const handleChange = (opt: SingleValue<CategorySelectOption>) => {
    if (!opt || !browse) return
    const path = pathFromLeafId(opt.value, browse.nodes)
    if (path?.length) onChange(opt.value, path)
  }

  if (!browse) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Chargement de la taxonomie…</p>
    )
  }

  return (
    <AsyncSelect<CategorySelectOption, false>
      instanceId="affisell-category-google-fr"
      cacheOptions
      defaultOptions={false}
      isDisabled={disabled}
      isClearable
      loadOptions={loadOptions}
      placeholder={placeholder}
      noOptionsMessage={({ inputValue }) =>
        inputValue.trim().length < 2
          ? "Tapez au moins 2 caractères."
          : "Aucune catégorie feuille correspondante."
      }
      loadingMessage={() => "Recherche…"}
      value={selected}
      onChange={handleChange}
      styles={selectStyles}
      menuPortalTarget={typeof document !== "undefined" ? document.body : null}
      menuPosition="fixed"
    />
  )
}
