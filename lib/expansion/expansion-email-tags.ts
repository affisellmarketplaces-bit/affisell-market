/** Resend tags — filter expansion buyer emails in webhook bounces/complaints/deliveries. */
export const EXPANSION_CHECKOUT_LAUNCH_TAG = { name: "expansion", value: "checkout-launch" } as const
export const EXPANSION_CHECKOUT_LAUNCH_FOLLOWUP_TAG = {
  name: "expansion",
  value: "checkout-launch-followup",
} as const
export const EXPANSION_CHECKOUT_GRADUATED_TAG = {
  name: "expansion",
  value: "checkout-graduated",
} as const

export type ExpansionResendTag = { name: string; value: string }

export function expansionCountryResendTag(countryIso2: string): ExpansionResendTag {
  return { name: "expansion-country", value: countryIso2.toLowerCase() }
}

export function expansionLaunchResendTags(countryIso2: string): ExpansionResendTag[] {
  return [EXPANSION_CHECKOUT_LAUNCH_TAG, expansionCountryResendTag(countryIso2)]
}

export function expansionLaunchFollowupResendTags(countryIso2: string): ExpansionResendTag[] {
  return [EXPANSION_CHECKOUT_LAUNCH_FOLLOWUP_TAG, expansionCountryResendTag(countryIso2)]
}

export function expansionGraduatedResendTags(countryIso2: string): ExpansionResendTag[] {
  return [EXPANSION_CHECKOUT_GRADUATED_TAG, expansionCountryResendTag(countryIso2)]
}

export function readExpansionCountryFromResendTags(
  tags: Record<string, string> | Array<{ name: string; value: string }> | undefined
): string | null {
  if (!tags) return null
  if (Array.isArray(tags)) {
    const country = tags.find((tag) => tag.name === "expansion-country")
    return country?.value?.toLowerCase() ?? null
  }
  const value = tags["expansion-country"]
  return typeof value === "string" && value.length > 0 ? value.toLowerCase() : null
}
