/** Quantum trust rail — client-safe chip tones & layout tokens. */

import type { StorefrontTrustRailColors } from "@/lib/storefront-header-chrome-shared"

export type TrustRailChipTone = "orbit" | "verified" | "secure" | "compliance"

export type TrustRailChipPalette = {
  border: string
  bg: string
  glow: string
  icon: string
  iconBg: string
  text: string
}

export function trustRailChipPalette(
  tone: TrustRailChipTone,
  colors: StorefrontTrustRailColors
): TrustRailChipPalette {
  switch (tone) {
    case "verified":
      return {
        border: "color-mix(in srgb, #10b981 50%, white 20%)",
        bg: "linear-gradient(135deg, color-mix(in srgb, #10b981 14%, white 86%) 0%, color-mix(in srgb, #059669 8%, white 92%) 100%)",
        glow: "color-mix(in srgb, #10b981 35%, transparent)",
        icon: "#059669",
        iconBg: "color-mix(in srgb, #10b981 18%, white 82%)",
        text: colors.text,
      }
    case "secure":
      return {
        border: "color-mix(in srgb, #f59e0b 48%, white 18%)",
        bg: "linear-gradient(135deg, color-mix(in srgb, #f59e0b 12%, white 88%) 0%, color-mix(in srgb, #d97706 8%, white 92%) 100%)",
        glow: "color-mix(in srgb, #f59e0b 32%, transparent)",
        icon: "#d97706",
        iconBg: "color-mix(in srgb, #f59e0b 16%, white 84%)",
        text: colors.text,
      }
    case "compliance":
      return {
        border: "color-mix(in srgb, #6366f1 42%, white 20%)",
        bg: "linear-gradient(135deg, color-mix(in srgb, #6366f1 10%, white 90%) 0%, color-mix(in srgb, #4f46e5 6%, white 94%) 100%)",
        glow: "color-mix(in srgb, #6366f1 28%, transparent)",
        icon: "#4f46e5",
        iconBg: "color-mix(in srgb, #6366f1 14%, white 86%)",
        text: colors.text,
      }
    default:
      return {
        border: colors.pillBorder,
        bg: `linear-gradient(135deg, ${colors.pillBg} 0%, color-mix(in srgb, ${colors.icon} 6%, white 94%) 100%)`,
        glow: `color-mix(in srgb, ${colors.icon} 30%, transparent)`,
        icon: colors.icon,
        iconBg: `color-mix(in srgb, ${colors.icon} 16%, white 84%)`,
        text: colors.text,
      }
  }
}
