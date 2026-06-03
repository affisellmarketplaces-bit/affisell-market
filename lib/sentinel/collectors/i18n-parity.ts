import en from "@/messages/en.json"
import fr from "@/messages/fr.json"
import type { SentinelSignalInput } from "@/lib/sentinel/types"

function messageKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  let keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(messageKeys(value as Record<string, unknown>, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

export function collectI18nParitySignals(): SentinelSignalInput[] {
  const ek = new Set(messageKeys(en as Record<string, unknown>))
  const fk = new Set(messageKeys(fr as Record<string, unknown>))
  const onlyEn = [...ek].filter((k) => !fk.has(k))
  const onlyFr = [...fk].filter((k) => !ek.has(k))
  const mismatch = onlyEn.length + onlyFr.length

  if (mismatch === 0) return []

  const sample = [...onlyEn.slice(0, 3), ...onlyFr.slice(0, 3)].join(", ")
  return [
    {
      severity: mismatch > 10 ? "P1" : "P2",
      domain: "platform",
      code: "platform.i18n_key_mismatch",
      title: "FR/EN translation key mismatch",
      detail: `${onlyEn.length} EN-only and ${onlyFr.length} FR-only keys. Sample: ${sample}${mismatch > 6 ? "…" : ""}.`,
      metric: mismatch,
    },
  ]
}
