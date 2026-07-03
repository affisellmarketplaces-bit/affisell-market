import { labelToCustomColumnKey } from "@/lib/product-custom-columns"
import { SIMPLE_COLOR_NAME_MAX } from "@/lib/supplier-simple-color-validation"

export type ParsedConfigurationColumn = {
  key: string
  label: string
  type: "text"
}

export type ParsedConfigurationRow = {
  label: string
  attributes: Record<string, string>
}

export type ParsedConfigurationMatrix = {
  customColumns: ParsedConfigurationColumn[]
  rows: ParsedConfigurationRow[]
}

type AttributeMatcher = {
  key: string
  label: string
  test: (segment: string) => boolean
}

const ATTRIBUTE_MATCHERS: AttributeMatcher[] = [
  {
    key: "ram",
    label: "RAM",
    test: (s) => /\bRAM\b/i.test(s) && /\d+\s*Go/i.test(s),
  },
  {
    key: "ssd",
    label: "Stockage SSD",
    test: (s) => /\bSSD\b/i.test(s) && /\d+\s*(?:Go|To)/i.test(s),
  },
  {
    key: "storage",
    label: "Stockage",
    test: (s) => /(?:stockage|storage|disque|hdd|nvme)/i.test(s) && /\d+\s*(?:Go|To)/i.test(s),
  },
  {
    key: "cpu",
    label: "Processeur",
    test: (s) =>
      /(?:processeur|processor|\bCPU\b|core\s*i[3579]|ryzen|snapdragon|m[1234]\s)/i.test(s),
  },
  {
    key: "gpu",
    label: "Graphique",
    test: (s) => /(?:rtx|gtx|graphique|gpu|carte\s*graphique)/i.test(s),
  },
  {
    key: "screen",
    label: "Écran",
    test: (s) => /(?:écran|ecran|screen|pouces|"\s*\d)/i.test(s),
  },
]

function looksLikeConfigurationLine(line: string): boolean {
  const t = line.trim()
  if (t.length < 6) return false
  if (/\d+\s*(?:Go|To)\b/i.test(t)) return true
  if (/\b(RAM|SSD|CPU|Go|To)\b/i.test(t) && /\d/.test(t)) return true
  return false
}

function splitConfigurationSegments(line: string): string[] {
  const cleaned = line.trim().replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "")
  return cleaned
    .split(/,(?=\s*(?:\d|[A-Za-zÀ-ÿ]))/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseConfigurationLine(line: string): Record<string, string> {
  const segments = splitConfigurationSegments(line)
  const attrs: Record<string, string> = {}

  for (const segment of segments) {
    let matched = false
    for (const matcher of ATTRIBUTE_MATCHERS) {
      if (matcher.test(segment) && !attrs[matcher.key]) {
        attrs[matcher.key] = segment.slice(0, 80)
        matched = true
        break
      }
    }
    if (!matched && segments.length === 1) {
      attrs.configuration = segment.slice(0, 80)
    }
  }

  return attrs
}

export function configurationRowLabel(attributes: Record<string, string>): string {
  const preferredOrder = ["cpu", "ram", "ssd", "storage", "gpu", "screen", "configuration"]
  const values: string[] = []
  for (const key of preferredOrder) {
    const v = attributes[key]?.trim()
    if (v) values.push(v.replace(/,/g, "/"))
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (preferredOrder.includes(key)) continue
    const v = value.trim()
    if (v) values.push(v.replace(/,/g, "/"))
  }
  return values.join(" / ").slice(0, SIMPLE_COLOR_NAME_MAX)
}

function rowFingerprint(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.trim().toLowerCase()}`)
    .join("|")
}

function extractRawConfigurationLines(prompt: string): string[] {
  const normalized = prompt.replace(/\r\n/g, "\n")
  const lines: string[] = []

  for (const rawLine of normalized.split("\n")) {
    let line = rawLine.trim()
    if (!line) continue

    line = line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "")

    const colonMatch = line.match(/^[^:]+:\s*(.+)$/)
    if (colonMatch) {
      const rest = colonMatch[1]!.trim()
      if (looksLikeConfigurationLine(rest)) {
        lines.push(rest)
        continue
      }
    }

    if (looksLikeConfigurationLine(line)) {
      lines.push(line)
    }
  }

  return lines
}

/** Parse RAM/SSD/CPU-style configuration lists from natural-language prompts (no AI). */
export function tryParseConfigurationMatrixFromPrompt(prompt: string): ParsedConfigurationMatrix | null {
  const rawLines = extractRawConfigurationLines(prompt)
  if (rawLines.length === 0) return null

  const parsedRows = rawLines
    .map((line) => ({
      attributes: parseConfigurationLine(line),
      label: "",
    }))
    .filter((row) => Object.keys(row.attributes).length > 0)

  if (parsedRows.length === 0) return null

  const isConfigStyle = parsedRows.some((row) =>
    Object.keys(row.attributes).some((k) =>
      ["ram", "ssd", "storage", "cpu", "gpu"].includes(k)
    )
  )
  if (!isConfigStyle) return null

  const seen = new Set<string>()
  const uniqueRows: ParsedConfigurationRow[] = []
  for (const row of parsedRows) {
    const fp = rowFingerprint(row.attributes)
    if (seen.has(fp)) continue
    seen.add(fp)
    uniqueRows.push({
      attributes: row.attributes,
      label: configurationRowLabel(row.attributes),
    })
    if (uniqueRows.length >= 120) break
  }

  if (uniqueRows.length === 0) return null

  const columnLabels = new Map<string, string>()
  for (const matcher of ATTRIBUTE_MATCHERS) {
    if (uniqueRows.some((row) => row.attributes[matcher.key])) {
      columnLabels.set(matcher.key, matcher.label)
    }
  }
  for (const row of uniqueRows) {
    for (const key of Object.keys(row.attributes)) {
      if (!columnLabels.has(key)) {
        columnLabels.set(key, key === "configuration" ? "Configuration" : key)
      }
    }
  }

  const customColumns: ParsedConfigurationColumn[] = [...columnLabels.entries()].map(
    ([key, label]) => ({
      key,
      label: label.slice(0, 32),
      type: "text" as const,
    })
  )

  return { customColumns, rows: uniqueRows }
}

export function sanitizeConfigurationVariantLabel(value: string): string {
  return value
    .trim()
    .replace(/,/g, " / ")
    .replace(/\s*·\s*/g, " / ")
    .replace(/\s+/g, " ")
    .slice(0, SIMPLE_COLOR_NAME_MAX)
}

export function normalizeCustomColumnsFromAi(
  raw: unknown
): ParsedConfigurationColumn[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: ParsedConfigurationColumn[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 32) : ""
    const keyRaw = typeof o.key === "string" ? o.key.trim() : labelToCustomColumnKey(label)
    const key = keyRaw.replace(/[^a-z_]/g, "").slice(0, 32) || labelToCustomColumnKey(label)
    if (!label || !key || seen.has(key)) continue
    seen.add(key)
    out.push({ key, label, type: "text" })
    if (out.length >= 10) break
  }
  return out
}
