import type { AbstractIntlMessages } from "next-intl"

/** Deep-merge locale overrides onto EN base (leaf strings replaced, objects merged). */
export function deepMergeMessages(
  base: AbstractIntlMessages,
  override: AbstractIntlMessages
): AbstractIntlMessages {
  const out: AbstractIntlMessages = { ...base }

  for (const key of Object.keys(override)) {
    const baseVal = base[key]
    const overrideVal = override[key]

    if (
      overrideVal !== null &&
      typeof overrideVal === "object" &&
      !Array.isArray(overrideVal) &&
      baseVal !== null &&
      typeof baseVal === "object" &&
      !Array.isArray(baseVal)
    ) {
      out[key] = deepMergeMessages(
        baseVal as AbstractIntlMessages,
        overrideVal as AbstractIntlMessages
      )
      continue
    }

    out[key] = overrideVal
  }

  return out
}
