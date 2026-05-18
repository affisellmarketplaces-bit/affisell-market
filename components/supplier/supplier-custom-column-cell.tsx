"use client"

import { Input } from "@/components/ui/input"
import { isCustomValueEmpty } from "@/lib/product-custom-columns"
import { cn } from "@/lib/utils"
import type { CustomColumn } from "@/types/product"

type Props = {
  column: CustomColumn
  value: string | number | boolean | undefined
  onChange: (value: string | number | boolean | undefined) => void
  invalid?: boolean
  disabled?: boolean
  className?: string
}

export function SupplierCustomColumnCell({
  column,
  value,
  onChange,
  invalid,
  disabled,
  className,
}: Props) {
  const borderClass = invalid
    ? "border-red-500 ring-2 ring-red-500/25 focus-visible:ring-red-500/30"
    : ""

  if (column.type === "boolean") {
    const checked = value === true || value === "true"
    return (
      <td className={cn("px-2 py-1.5", className)}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className={cn("h-4 w-4 rounded border-zinc-300", invalid && "outline outline-2 outline-red-500")}
          aria-invalid={invalid}
        />
      </td>
    )
  }

  if (column.type === "select") {
    return (
      <td className={cn("px-2 py-1.5", className)}>
        <select
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={cn(
            "h-9 w-full min-w-[88px] rounded-md border border-zinc-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900",
            borderClass
          )}
          aria-invalid={invalid}
        >
          <option value="">—</option>
          {(column.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </td>
    )
  }

  if (column.type === "number") {
    return (
      <td className={cn("px-2 py-1.5", className)}>
        <Input
          type="number"
          disabled={disabled}
          value={value == null || value === "" ? "" : String(value)}
          onChange={(e) => {
            const raw = e.target.value
            if (!raw.trim()) onChange(undefined)
            else {
              const n = Number(raw)
              onChange(Number.isFinite(n) ? n : undefined)
            }
          }}
          className={cn("h-9", borderClass)}
          aria-invalid={invalid}
        />
      </td>
    )
  }

  if (column.type === "url") {
    const str = typeof value === "string" ? value : ""
    return (
      <td className={cn("px-2 py-1.5", className)}>
        <div className="space-y-1">
          <Input
            type="url"
            disabled={disabled}
            value={str}
            onChange={(e) => onChange(e.target.value || undefined)}
            placeholder="https://"
            className={cn("h-9", borderClass)}
            aria-invalid={invalid}
          />
          {str.trim() && !isCustomValueEmpty("url", str) ? (
            <a
              href={str.startsWith("http") ? str : `https://${str}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[10px] text-violet-600 underline dark:text-violet-400"
            >
              Aperçu
            </a>
          ) : null}
        </div>
      </td>
    )
  }

  return (
    <td className={cn("px-2 py-1.5", className)}>
      <Input
        type="text"
        disabled={disabled}
        value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={cn("h-9", borderClass)}
        aria-invalid={invalid}
      />
    </td>
  )
}

export function isCustomCellInvalid(
  column: CustomColumn,
  value: string | number | boolean | undefined
): boolean {
  return column.required && isCustomValueEmpty(column.type, value)
}
