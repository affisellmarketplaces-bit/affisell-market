import { applyAutoDsTrackingUpdate } from "@/lib/autods/apply-tracking-update"
import { prisma } from "@/lib/prisma"

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://affisell.com").replace(/\/$/, "")
}

export function wooCommerceSystemStatus() {
  const base = siteUrl()
  return {
    environment: {
      home_url: `${base}/`,
      site_url: `${base}/`,
      version: "9.4.2",
      wp_version: "6.5.0",
      wp_multisite: false,
      wp_debug_mode: false,
      language: "fr_FR",
      server_info: "Affisell",
    },
    database: {
      wc_database_version: "9.4.2",
    },
    settings: {
      currency: "EUR",
    },
  }
}

export function wooCommerceIndexRoute() {
  const base = siteUrl()
  return {
    namespace: "wc/v3",
    routes: {
      "/wc/v3": {
        namespace: "wc/v3",
        methods: ["GET"],
      },
      "/wc/v3/system_status": {
        namespace: "wc/v3",
        methods: ["GET"],
      },
      "/wc/v3/orders": {
        namespace: "wc/v3",
        methods: ["GET", "POST"],
      },
    },
    _links: {
      self: [{ href: `${base}/wp-json/wc/v3` }],
    },
  }
}

export async function wooCommerceListOrders(searchParams: URLSearchParams) {
  if (process.env.AUTODS_WOOCOMMERCE_EXPOSE_ORDERS !== "1") {
    return Response.json([], {
      headers: {
        "X-WP-Total": "0",
        "X-WP-TotalPages": "0",
      },
    })
  }

  const perPage = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("per_page") ?? "10", 10)))
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10))
  const status = searchParams.get("status")?.trim()

  const where = {
    status: status && status !== "any" ? status : "paid",
    autodsOrderId: null,
  }

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ])

  const orders = rows.map((order, index) => mapAffisellOrderToWooCommerce(order, index))

  return Response.json(orders, {
    headers: {
      "X-WP-Total": String(total),
      "X-WP-TotalPages": String(Math.max(1, Math.ceil(total / perPage))),
    },
  })
}

function mapAffisellOrderToWooCommerce(
  order: {
    id: string
    quantity: number
    sellingPriceCents: number
    customerEmail: string
    createdAt: Date
    status: string
    trackingNumber: string | null
    product: { name: string }
  },
  index: number
) {
  const numericId = stableNumericId(order.id)
  return {
    id: numericId,
    number: String(numericId),
    order_key: `wc_order_${order.id.slice(0, 12)}`,
    status: order.status === "paid" ? "processing" : order.status,
    currency: "EUR",
    date_created: order.createdAt.toISOString(),
    total: (order.sellingPriceCents / 100).toFixed(2),
    billing: {
      email: order.customerEmail,
    },
    line_items: [
      {
        id: index + 1,
        name: order.product.name,
        quantity: order.quantity,
        total: (order.sellingPriceCents / 100).toFixed(2),
        sku: order.id,
      },
    ],
    meta_data: [{ key: "_affisell_order_id", value: order.id }],
  }
}

function stableNumericId(orderId: string): number {
  let hash = 0
  for (let i = 0; i < orderId.length; i += 1) {
    hash = (hash * 31 + orderId.charCodeAt(i)) >>> 0
  }
  return (hash % 900_000_000) + 100_000
}

function readMetaValue(meta: unknown, key: string): string | null {
  if (!Array.isArray(meta)) return null
  for (const item of meta) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    if (row.key === key && typeof row.value === "string") return row.value.trim() || null
  }
  return null
}

export async function wooCommerceUpdateOrder(orderId: string, body: unknown): Promise<Response> {
  const numericId = Number.parseInt(orderId, 10)
  if (!Number.isFinite(numericId)) {
    return Response.json({ code: "rest_invalid_id", message: "Invalid ID." }, { status: 404 })
  }

  const affisellOrderId = readMetaValue(
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).meta_data
      : null,
    "_affisell_order_id"
  )

  let order =
    affisellOrderId != null
      ? await prisma.order.findUnique({ where: { id: affisellOrderId } })
      : null

  if (!order) {
    const candidates = await prisma.order.findMany({
      where: { status: "paid" },
      take: 500,
      orderBy: { createdAt: "desc" },
    })
    order = candidates.find((row) => stableNumericId(row.id) === numericId) ?? null
  }

  if (!order) {
    return Response.json({ code: "woocommerce_rest_invalid_id", message: "Invalid order ID." }, { status: 404 })
  }

  const meta =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).meta_data
      : null

  const trackingNumber =
    readMetaValue(meta, "_tracking_number") ??
    readMetaValue(meta, "_wc_shipment_tracking_items") ??
    (typeof (body as Record<string, unknown> | null)?.tracking_number === "string"
      ? ((body as Record<string, unknown>).tracking_number as string)
      : null)

  const trackingUrl =
    readMetaValue(meta, "_tracking_url") ??
    (typeof (body as Record<string, unknown> | null)?.tracking_url === "string"
      ? ((body as Record<string, unknown>).tracking_url as string)
      : null)

  const carrier =
    readMetaValue(meta, "_tracking_provider") ??
    readMetaValue(meta, "_wc_shipment_tracking_provider") ??
    null

  const statusRaw =
    typeof (body as Record<string, unknown> | null)?.status === "string"
      ? ((body as Record<string, unknown>).status as string)
      : trackingNumber
        ? "completed"
        : order.autodsStatus ?? "PROCESSING"

  const autodsOrderId = order.autodsOrderId ?? order.id

  if (trackingNumber || (body as Record<string, unknown> | null)?.status === "completed") {
    await applyAutoDsTrackingUpdate({
      payload: {
        autodsOrderId,
        status: statusRaw === "completed" ? "SHIPPED" : statusRaw.toUpperCase(),
        trackingNumber,
        trackingUrl,
        carrier,
      },
      source: "admin_resync",
      event: "woocommerce_order_update",
      response: body,
    })
  }

  const fresh = await prisma.order.findUnique({
    where: { id: order.id },
    include: { product: { select: { name: true } } },
  })
  if (!fresh) {
    return Response.json({ code: "woocommerce_rest_invalid_id", message: "Invalid order ID." }, { status: 404 })
  }

  return Response.json(mapAffisellOrderToWooCommerce(fresh, 0))
}

export async function wooCommerceGetOrder(orderId: string): Promise<Response> {
  const numericId = Number.parseInt(orderId, 10)
  if (!Number.isFinite(numericId)) {
    return Response.json({ code: "rest_invalid_id", message: "Invalid ID." }, { status: 404 })
  }

  const candidates = await prisma.order.findMany({
    where: { status: { in: ["paid", "shipped"] } },
    include: { product: { select: { name: true } } },
    take: 500,
    orderBy: { createdAt: "desc" },
  })
  const order = candidates.find((row) => stableNumericId(row.id) === numericId)
  if (!order) {
    return Response.json({ code: "woocommerce_rest_invalid_id", message: "Invalid order ID." }, { status: 404 })
  }

  return Response.json(mapAffisellOrderToWooCommerce(order, 0))
}
