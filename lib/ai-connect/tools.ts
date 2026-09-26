import { z } from "zod"

import { loadAffiliateDashboardAnalytics } from "@/lib/affiliate-dashboard-analytics"
import { prisma } from "@/lib/prisma"
import { assertSafeOutboundUrl } from "@/lib/safe-outbound-url"
import { getSupplierAnalytics } from "@/lib/supplier-dashboard-analytics"
import { scrapeSupplierProductFromUrl } from "@/lib/supplier-import-url-handler"

/** Errors safe to show to the calling AI; anything else is reported as a generic failure. */
export class AiToolError extends Error {}

export type AiToolRole = "SUPPLIER" | "AFFILIATE"

export type AiToolContext = { userId: string; role: string }

export type AiToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string
  description: string
  /** Roles allowed to call the tool. ADMIN accounts are treated like SUPPLIER. */
  roles: AiToolRole[]
  input: S
  /** "async" tools return a mission id immediately and finish in the background. */
  mode: "sync" | "async"
  run: (ctx: AiToolContext, args: z.infer<S>) => Promise<unknown>
}

export function effectiveToolRole(role: string): AiToolRole | null {
  if (role === "SUPPLIER" || role === "ADMIN") return "SUPPLIER"
  if (role === "AFFILIATE") return "AFFILIATE"
  return null
}

const limitSchema = z.object({ limit: z.number().int().min(1).max(50).optional() })

function defineTool<S extends z.ZodTypeAny>(def: AiToolDef<S>): AiToolDef {
  return def as unknown as AiToolDef
}

const whoami = defineTool({
  name: "whoami",
  description: "Which Affisell account and role this AI key acts as.",
  roles: ["SUPPLIER", "AFFILIATE"],
  mode: "sync",
  input: z.object({}),
  async run(ctx) {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, role: true },
    })
    return { name: user?.name ?? null, role: user?.role ?? ctx.role }
  },
})

const salesSummary = defineTool({
  name: "sales_summary",
  description:
    "Last-30-days sales summary: revenue, payout estimate and top performers. Amounts are in cents.",
  roles: ["SUPPLIER", "AFFILIATE"],
  mode: "sync",
  input: z.object({}),
  async run(ctx) {
    if (effectiveToolRole(ctx.role) === "AFFILIATE") {
      const a = await loadAffiliateDashboardAnalytics(ctx.userId)
      return {
        revenue30dCents: a.totalRevenue30dCents,
        revenuePrev30dCents: a.totalRevenuePrev30dCents ?? null,
        estimatedPayoutJ7Cents: a.estimatedPayoutJ7Cents,
        topProducts: a.topProductsEpc.slice(0, 5),
      }
    }
    const a = await getSupplierAnalytics(ctx.userId)
    return {
      revenue30dCents: a.totalRevenue30dCents,
      revenuePrev30dCents: a.totalRevenuePrev30dCents ?? null,
      netMarginCents: a.netMarginCents,
      returnRatePct: a.returnRatePct,
      estimatedNextPayoutCents: a.estimatedNextPayoutCents,
      estimatedNextPayoutDate: a.estimatedNextPayoutDate,
      zeroSalesAlert: a.zeroSalesAlert,
      topProducts: a.skuPerformance.slice(0, 8),
      topAffiliates: a.topAffiliates.slice(0, 5),
    }
  },
})

const listProducts = defineTool({
  name: "list_products",
  description:
    "Products in the catalog (suppliers) or listings in the storefront (affiliates), most recent first. Prices in cents.",
  roles: ["SUPPLIER", "AFFILIATE"],
  mode: "sync",
  input: limitSchema,
  async run(ctx, args: z.infer<typeof limitSchema>) {
    const take = args.limit ?? 20
    if (effectiveToolRole(ctx.role) === "AFFILIATE") {
      const rows = await prisma.affiliateProduct.findMany({
        where: { affiliateId: ctx.userId },
        orderBy: { id: "desc" },
        take,
        select: {
          id: true,
          productId: true,
          sellingPriceCents: true,
          isListed: true,
          clicks: true,
          conversions: true,
          product: { select: { name: true, basePriceCents: true } },
        },
      })
      return rows.map((r) => ({
        listingId: r.id,
        productId: r.productId,
        name: r.product.name,
        supplierPriceCents: r.product.basePriceCents,
        sellingPriceCents: r.sellingPriceCents,
        listed: r.isListed,
        clicks: r.clicks,
        conversions: r.conversions,
      }))
    }
    const rows = await prisma.product.findMany({
      where: { supplierId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, name: true, basePriceCents: true, createdAt: true },
    })
    return rows.map((r) => ({
      productId: r.id,
      name: r.name,
      basePriceCents: r.basePriceCents,
      createdAt: r.createdAt,
    }))
  },
})

const listRecentOrders = defineTool({
  name: "list_recent_orders",
  description: "Most recent orders on this account. No buyer personal data is ever returned.",
  roles: ["SUPPLIER", "AFFILIATE"],
  mode: "sync",
  input: limitSchema,
  async run(ctx, args: z.infer<typeof limitSchema>) {
    const isAffiliate = effectiveToolRole(ctx.role) === "AFFILIATE"
    const rows = await prisma.order.findMany({
      where: isAffiliate ? { affiliateId: ctx.userId } : { supplierId: ctx.userId },
      orderBy: { createdAt: "desc" },
      take: args.limit ?? 20,
      select: { id: true, status: true, quantity: true, createdAt: true, productId: true },
    })
    return rows.map((r) => ({
      orderId: r.id,
      status: r.status,
      quantity: r.quantity,
      productId: r.productId,
      createdAt: r.createdAt,
    }))
  },
})

const importSchema = z.object({ url: z.string().min(8).max(2000) })

const previewProductImport = defineTool({
  name: "preview_product_import",
  description:
    "Reads a public product page (CJ Dropshipping, BigBuy, 1688, Shopify, generic shops…) and returns a product draft PREVIEW: title, price, images, variants. Nothing is created or published — the supplier reviews it in Affisell. Runs in the background: returns a missionId, then poll get_mission.",
  roles: ["SUPPLIER"],
  mode: "async",
  input: importSchema,
  async run(_ctx, args: z.infer<typeof importSchema>) {
    const safe = assertSafeOutboundUrl(args.url)
    if (!safe.ok) throw new AiToolError(`Refused URL: ${safe.error}`)
    const out = await scrapeSupplierProductFromUrl({ url: safe.url.toString(), options: { fast: true } })
    if (!out.ok) throw new AiToolError(out.error)
    const p = out.product
    return {
      platform: out.platform,
      warnings: out.warnings,
      preview: {
        title: p.title,
        description: p.description.slice(0, 1500),
        price: p.price,
        currency: p.currency,
        images: p.images.slice(0, 8),
        variants: p.variants.slice(0, 20),
        brand: p.brand,
        category: p.category,
      },
    }
  },
})

const getMission = defineTool({
  name: "get_mission",
  description: "Status and result of a background mission started earlier by this account.",
  roles: ["SUPPLIER", "AFFILIATE"],
  mode: "sync",
  input: z.object({ missionId: z.string().min(1).max(64) }),
  async run(ctx, args: { missionId: string }) {
    const m = await prisma.aiMission.findFirst({
      where: { id: args.missionId, userId: ctx.userId },
      select: { id: true, tool: true, status: true, result: true, error: true, createdAt: true, completedAt: true },
    })
    if (!m) throw new AiToolError("Mission not found")
    return m
  },
})

export const AI_TOOLS: AiToolDef[] = [
  whoami,
  salesSummary,
  listProducts,
  listRecentOrders,
  previewProductImport,
  getMission,
]

export function toolsForRole(role: string): AiToolDef[] {
  const eff = effectiveToolRole(role)
  if (!eff) return []
  return AI_TOOLS.filter((t) => t.roles.includes(eff))
}
