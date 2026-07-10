import { devLocalhostUrlWithQuery } from "@/lib/dev-localhost-url"

export const WIZARD_V2_NEW_PRODUCT_PATH = "/dashboard/supplier/products/new"

/** Local dev entry URL for wizard v2 (respects PORT). Quote in zsh or use npm run dev:open:wizard-v2. */
export function buildWizardV2NewProductUrl(
  query: Record<string, string> = { wizard: "v2", compose: "1" },
  env: NodeJS.ProcessEnv = process.env
): string {
  return devLocalhostUrlWithQuery(WIZARD_V2_NEW_PRODUCT_PATH, query, env)
}

/** Shell-safe quoted URL for copy/paste in zsh/bash. */
export function quoteShellUrl(url: string): string {
  return JSON.stringify(url)
}
