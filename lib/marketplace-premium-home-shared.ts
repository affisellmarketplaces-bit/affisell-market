/** Premium marketplace home — tokens + department pill styling (ref-full-decoupage). */

export const PREMIUM_MARKETPLACE_HOME = {
  pageBg: "#6B4EFF",
  heroGradient: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
  panelBg: "#ffffff",
  /** WCAG-friendly on white panels */
  departmentsLabel: "#6D28D9",
  departmentsHint: "#334155",
  panelBody: "#1E293B",
  panelMuted: "#475569",
  sidebarBg: "linear-gradient(180deg, #1E1B4B 0%, #312E81 100%)",
  sidebarHeader: "linear-gradient(90deg, #7C3AED 0%, #06B6D4 100%)",
  sidebarHeaderSub: "#EDE9FE",
  sidebarActive: "#F3E8FF",
  sidebarActiveText: "#4C1D95",
  europeBanner: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)",
  europeSubtitle: "#E9D5FF",
  shipsPill: "#EDE9FE",
  shipsPillText: "#5B21B6",
  conditionActive: "#7C3AED",
  conditionLabel: "#334155",
} as const

export type PremiumCategoryItem = {
  id: string
  name: string
  slug: string
  icon: string
  count: number
  fullPath?: string
}

export type DepartmentPillStyle = {
  bg: string
  text: string
}

/** Map Google L1 names → mockup pill colors. */
export function resolveDepartmentPillStyle(name: string): DepartmentPillStyle {
  const n = name.toLowerCase()
  if (n.includes("électron") || n.includes("electron")) return { bg: "#FEF3C7", text: "#92400E" }
  if (
    n.includes("vêtement") ||
    n.includes("vetement") ||
    n.includes("apparel") ||
    n.includes("accessoir") ||
    n.includes("mode")
  ) {
    return { bg: "#FCE7F3", text: "#9D174D" }
  }
  if (n.includes("santé") || n.includes("sante") || n.includes("beauté") || n.includes("beaute") || n.includes("health")) {
    return { bg: "#FCE7F3", text: "#9D174D" }
  }
  if (n.includes("maison") || n.includes("jardin") || n.includes("home") || n.includes("garden")) {
    return { bg: "#D1FAE5", text: "#065F46" }
  }
  if (n.includes("bureau") || n.includes("office")) return { bg: "#DBEAFE", text: "#1E40AF" }
  if (n.includes("meuble") || n.includes("furniture")) return { bg: "#FFEDD5", text: "#9A3412" }
  return { bg: "#F3E8FF", text: "#6D28D9" }
}
