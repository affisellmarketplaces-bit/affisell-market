import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type TryOnSlice = {
  try_on_enabled?: boolean
  tryon_garment_url?: string | null
}

type ProductWithTryOn = Record<string, unknown> & {
  product_try_on?: TryOnSlice | null
  try_on?: TryOnSlice | null
}

function flattenTryOnFields(product: ProductWithTryOn): ProductWithTryOn {
  const linked = product.product_try_on ?? product.try_on
  if (!linked) return product
  return {
    ...product,
    try_on_enabled: linked.try_on_enabled ?? false,
    tryon_garment_url: linked.tryon_garment_url ?? null,
  }
}

async function enrichProductWithTryOn(
  scope: MedusaRequest["scope"],
  product: ProductWithTryOn
): Promise<ProductWithTryOn> {
  const flattened = flattenTryOnFields(product)
  if (flattened.try_on_enabled !== undefined) return flattened
  const productId = typeof product.id === "string" ? product.id : null
  if (!productId) return flattened
  const linked = await queryProductTryOnByProductId(scope, productId)
  if (!linked) {
    return { ...flattened, try_on_enabled: false, tryon_garment_url: null }
  }
  return {
    ...flattened,
    try_on_enabled: linked.try_on_enabled ?? false,
    tryon_garment_url: linked.tryon_garment_url ?? null,
  }
}

/** Whitelist try-on fields on store product responses (GET /store/products*). */
export async function enrichStoreProductsWithTryOn(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const originalJson = res.json.bind(res)
  res.json = ((body: unknown) => {
    void (async () => {
      if (!body || typeof body !== "object") {
        originalJson(body)
        return
      }
      const payload = { ...(body as Record<string, unknown>) }
      if (Array.isArray(payload.products)) {
        payload.products = await Promise.all(
          payload.products.map((p) => enrichProductWithTryOn(req.scope, p as ProductWithTryOn))
        )
      }
      if (payload.product) {
        payload.product = await enrichProductWithTryOn(
          req.scope,
          payload.product as ProductWithTryOn
        )
      }
      originalJson(payload)
    })().catch(() => originalJson(body))
    return res
  }) as typeof res.json

  next()
}

/** Ensure linked try-on relation is queried when fields param requests it. */
export async function ensureTryOnFieldsQuery(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const fields = req.query.fields
  const fieldsStr = typeof fields === "string" ? fields : ""
  if (!fieldsStr.includes("product_try_on")) {
    req.query.fields = fieldsStr ? `${fieldsStr},+product_try_on.*` : "+product_try_on.*"
  }
  next()
}

/** Redis / in-memory cache tag hint for store products (60s via cache-redis module ttl). */
export async function tagStoreProductsCache(
  _req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120")
  res.setHeader("X-Affisell-TryOn-Cache", "60s")
  next()
}

export const storeProductsTryOnMiddlewares = [
  ensureTryOnFieldsQuery,
  tagStoreProductsCache,
  enrichStoreProductsWithTryOn,
]

export async function queryProductTryOnByProductId(
  container: MedusaRequest["scope"],
  productId: string
): Promise<TryOnSlice | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "product_try_on.try_on_enabled", "product_try_on.tryon_garment_url"],
    filters: { id: productId },
  })
  const row = data?.[0] as ProductWithTryOn | undefined
  const linked = row?.product_try_on ?? row?.try_on
  if (!linked) return null
  return {
    try_on_enabled: linked.try_on_enabled ?? false,
    tryon_garment_url: linked.tryon_garment_url ?? null,
  }
}
