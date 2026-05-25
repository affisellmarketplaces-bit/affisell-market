import type { ExtensionSettings } from "./config.js"

export class AffisellApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function apiFetch(
  settings: ExtensionSettings,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = `${settings.apiBase}${path}`
  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${settings.token}`)
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  return fetch(url, { ...init, headers })
}

export async function checkSession(settings: ExtensionSettings): Promise<{
  ok: boolean
  email?: string
}> {
  const res = await apiFetch(settings, "/api/supplier/extension/session")
  if (!res.ok) return { ok: false }
  const data = (await res.json()) as { user?: { email?: string } }
  return { ok: true, email: data.user?.email }
}

export async function importFromUrl(
  settings: ExtensionSettings,
  url: string,
  options?: { markup?: number; aiRewrite?: boolean }
): Promise<{
  product: Record<string, unknown>
  platform?: string
  warnings?: string[]
}> {
  const res = await apiFetch(settings, "/api/supplier/extension/import-url", {
    method: "POST",
    body: JSON.stringify({ url, options: options ?? { markup: 2.5, aiRewrite: false } }),
  })
  const data = (await res.json()) as {
    products?: unknown[]
    error?: string
    useAliExpressApi?: boolean
    warnings?: string[]
    platform?: string
  }
  if (!res.ok) {
    throw new AffisellApiError(data.error ?? "Import impossible", res.status)
  }
  const raw = Array.isArray(data.products) ? data.products[0] : null
  if (!raw || typeof raw !== "object") {
    throw new AffisellApiError("Aucune donnée produit", 422)
  }
  return {
    product: raw as Record<string, unknown>,
    platform: data.platform,
    warnings: data.warnings,
  }
}

export async function importAliExpress(
  settings: ExtensionSettings,
  productId: string
): Promise<{ productId: string; editUrl: string }> {
  const res = await apiFetch(settings, "/api/supplier/extension/aliexpress", {
    method: "POST",
    body: JSON.stringify({ productId }),
  })
  const data = (await res.json()) as {
    error?: string
    product?: { id?: string }
    editUrl?: string
    productId?: string
  }
  if (res.status === 409 && data.productId && data.editUrl) {
    return { productId: data.productId, editUrl: data.editUrl }
  }
  if (!res.ok) {
    throw new AffisellApiError(data.error ?? "Import AliExpress échoué", res.status)
  }
  const id = data.product?.id ?? ""
  const editUrl = data.editUrl ?? ""
  if (!id) throw new AffisellApiError("Réponse invalide", 422)
  return { productId: id, editUrl }
}

export async function saveDraft(
  settings: ExtensionSettings,
  product: Record<string, unknown>
): Promise<{ editUrl: string; name: string }> {
  const res = await apiFetch(settings, "/api/supplier/extension/products", {
    method: "POST",
    body: JSON.stringify({ product }),
  })
  const data = (await res.json()) as {
    error?: string
    products?: Array<{ id?: string; name?: string }>
    editUrls?: string[]
  }
  if (!res.ok) {
    throw new AffisellApiError(data.error ?? "Enregistrement échoué", res.status)
  }
  const id = data.products?.[0]?.id
  const editUrl = data.editUrls?.[0] ?? (id ? `${settings.apiBase}/dashboard/supplier/products/${id}` : "")
  const name = data.products?.[0]?.name ?? ""
  if (!editUrl) throw new AffisellApiError("Produit non créé", 422)
  return { editUrl, name }
}
