/** Deep links — keep in sync with `resolveProductWizardVersion` / `resolveWizardV2Mode`. */
export const WIZARD_V2_PRO_HREF =
  "/dashboard/supplier/products/new?wizard=v2&mode=pro&compose=1" as const

export const WIZARD_V2_EXPRESS_HREF =
  "/dashboard/supplier/products/new?wizard=v2&mode=express&compose=1" as const

export function normalizeWizardV2SearchParams(
  input: URLSearchParams,
  opts?: { defaultMode?: "pro" | "express" }
): URLSearchParams {
  const qs = new URLSearchParams(input.toString())
  if (!qs.has("compose")) qs.set("compose", "1")
  if (!qs.has("wizard")) qs.set("wizard", "v2")
  if (!qs.get("mode")?.trim()) qs.set("mode", opts?.defaultMode ?? "pro")
  return qs
}
