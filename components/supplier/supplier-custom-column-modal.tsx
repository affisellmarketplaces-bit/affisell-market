"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { labelToCustomColumnKey } from "@/lib/product-custom-columns"
import type { CustomColumn, CustomColumnType } from "@/types/product"

const TYPES: { value: CustomColumnType; label: string }[] = [
  { value: "text", label: "Texte" },
  { value: "number", label: "Nombre" },
  { value: "boolean", label: "Oui / Non" },
  { value: "url", label: "URL" },
  { value: "select", label: "Liste (select)" },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingKeys: string[]
  maxColumns?: number
  onSave: (column: CustomColumn) => void
}

export function SupplierCustomColumnModal({
  open,
  onOpenChange,
  existingKeys,
  maxColumns = 10,
  onSave,
}: Props) {
  const [label, setLabel] = useState("")
  const [type, setType] = useState<CustomColumnType>("text")
  const [required, setRequired] = useState(false)
  const [optionsText, setOptionsText] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setLabel("")
      setType("text")
      setRequired(false)
      setOptionsText("")
      setError(null)
    }
  }, [open])

  const keyPreview = label.trim() ? labelToCustomColumnKey(label) : ""

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) {
      setError("Libellé requis")
      return
    }
    const key = labelToCustomColumnKey(trimmed)
    if (!/^[a-z_]+$/.test(key)) {
      setError("Libellé invalide")
      return
    }
    if (existingKeys.includes(key)) {
      setError("Une colonne avec cette clé existe déjà")
      return
    }
    const options =
      type === "select"
        ? optionsText
            .split(/[,;\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 32)
        : undefined
    if (type === "select" && (!options || options.length === 0)) {
      setError("Ajoutez au moins une option (séparées par des virgules)")
      return
    }
    onSave({ key, label: trimmed.slice(0, 32), type, required, options })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Colonne personnalisée</h2>
          <p className="text-sm text-zinc-500">Définissez un champ métier pour toutes les lignes SKU.</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="cc-label">Libellé</Label>
            <Input
              id="cc-label"
              className="mt-1.5"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex. Indice IP, Matière"
              maxLength={32}
            />
            {keyPreview ? (
              <p className="mt-1 text-[11px] text-zinc-500">
                Clé : <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{keyPreview}</code>
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="cc-type">Type</Label>
            <select
              id="cc-type"
              className="mt-1.5 flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={type}
              onChange={(e) => setType(e.target.value as CustomColumnType)}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Champ requis sur chaque ligne SKU
          </label>

          {type === "select" ? (
            <div>
              <Label htmlFor="cc-options">Options</Label>
              <Input
                id="cc-options"
                className="mt-1.5"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="IP44, IP67"
              />
              <p className="mt-1 text-[11px] text-zinc-500">Séparez par des virgules</p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <p className="text-[11px] text-zinc-500">
            Maximum {maxColumns} colonnes personnalisées par produit.
          </p>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1">
              Ajouter la colonne
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
