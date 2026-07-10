import { devLocalhostUrlWithQuery } from "./dev-localhost-url.mjs"

export const WIZARD_V2_NEW_PRODUCT_PATH = "/dashboard/supplier/products/new"

export function buildWizardV2NewProductUrl(
  query = { wizard: "v2", compose: "1" },
  env = process.env
) {
  return devLocalhostUrlWithQuery(WIZARD_V2_NEW_PRODUCT_PATH, query, env)
}

export function quoteShellUrl(url) {
  return JSON.stringify(url)
}
