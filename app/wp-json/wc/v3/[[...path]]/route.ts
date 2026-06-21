import { NextRequest } from "next/server"

import {
  wooCommerceGetOrder,
  wooCommerceIndexRoute,
  wooCommerceListOrders,
  wooCommerceSystemStatus,
  wooCommerceUpdateOrder,
} from "@/lib/woocommerce-compat/rest-handlers"
import {
  verifyWooCommerceBasicAuth,
  wooCommerceUnauthorizedResponse,
} from "@/lib/woocommerce-compat/verify-basic-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ path?: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const authRow = await verifyWooCommerceBasicAuth(req)
  if (!authRow) return wooCommerceUnauthorizedResponse()

  const { path = [] } = await ctx.params
  const joined = path.join("/")

  if (joined === "" || joined === "/") {
    return Response.json(wooCommerceIndexRoute())
  }

  if (joined === "system_status") {
    return Response.json(wooCommerceSystemStatus())
  }

  if (joined === "orders") {
    return wooCommerceListOrders(req.nextUrl.searchParams)
  }

  const orderMatch = /^orders\/(\d+)$/.exec(joined)
  if (orderMatch?.[1]) {
    return wooCommerceGetOrder(orderMatch[1])
  }

  return Response.json(
    {
      code: "rest_no_route",
      message: `No route was found matching the URL and request method.`,
      data: { status: 404 },
    },
    { status: 404 }
  )
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const authRow = await verifyWooCommerceBasicAuth(req)
  if (!authRow) return wooCommerceUnauthorizedResponse()
  if (authRow.scope === "read") {
    return Response.json(
      { code: "woocommerce_rest_authentication_error", message: "Write scope required." },
      { status: 401 }
    )
  }

  const { path = [] } = await ctx.params
  const orderMatch = /^orders\/(\d+)$/.exec(path.join("/"))
  if (!orderMatch?.[1]) {
    return Response.json({ code: "rest_no_route", message: "Not found." }, { status: 404 })
  }

  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    body = null
  }

  return wooCommerceUpdateOrder(orderMatch[1], body)
}
