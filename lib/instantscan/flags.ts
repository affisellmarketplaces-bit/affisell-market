import { isAiVisionV2Enabled, isInstantScanEnabled } from "@/lib/ai/product-vision-v2-config"

/** Server — InstantScan or legacy vision v2 enabled. */
export function isInstantScanServerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isInstantScanEnabled(env) || isAiVisionV2Enabled(env)
}

/** Client — public override; defaults true (server decides on API). */
export function isInstantScanClientEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const pub = env.NEXT_PUBLIC_ENABLE_INSTANTSCAN?.trim().toLowerCase()
  if (pub === "0" || pub === "false") return false
  if (pub === "1" || pub === "true") return true
  return true
}
