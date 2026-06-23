import { defineMiddlewares } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { tryOnAdditionalDataValidator } from "./admin/products/validators"
import { checkAdminTryOnRateLimit } from "../lib/rate-limit"
import { storeProductsTryOnMiddlewares } from "./store/products/middlewares"

async function adminTryOnRateLimitMiddleware(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const productId = req.params.id ?? "create"
  const actor = req.auth_context?.actor_id ?? req.ip ?? "anonymous"
  const key = `admin-tryon:${actor}:${productId}`
  const limited = checkAdminTryOnRateLimit(key, 10)
  if (!limited.ok) {
    res.status(429).json({
      message: "Try-on admin rate limit exceeded (10/min)",
      retry_after: limited.retryAfterSec,
    })
    return
  }
  next()
}

export default defineMiddlewares({
  routes: [
    {
      method: "POST",
      matcher: "/admin/products",
      middlewares: [adminTryOnRateLimitMiddleware],
      additionalDataValidator: tryOnAdditionalDataValidator,
    },
    {
      method: "POST",
      matcher: "/admin/products/:id",
      middlewares: [adminTryOnRateLimitMiddleware],
      additionalDataValidator: tryOnAdditionalDataValidator,
    },
    {
      method: "POST",
      matcher: "/admin/products/:id/try-on",
      middlewares: [adminTryOnRateLimitMiddleware],
    },
    {
      method: ["GET"],
      matcher: "/store/products*",
      middlewares: storeProductsTryOnMiddlewares,
    },
  ],
})
