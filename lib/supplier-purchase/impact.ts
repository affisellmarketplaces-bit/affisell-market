/**
 * What the default lock (#35) stops, measured — READ-ONLY SQL used by `npm run report:supplier-purchase-impact`.
 * A product "depends on an automatic supplier purchase" when nothing ships it unless Affisell buys it:
 *   aliexpress_auto_buy — active SupplierLink with autoBuyEnabled (path A/B/D: webhook auto-buy);
 *   engine_<channel>    — autoFulfill + a channel whose adapter buys (ALIEXPRESS, CJ_DROPSHIPPING, BLIND_REST), or an
 *                         AliExpress import without an explicit channel (the engine infers ALIEXPRESS) — an upper bound;
 *   china_agent         — a China buying agent chosen at import.
 * Paid orders still waiting for that purchase are the ones a buyer has paid for and nobody will ship while the lock
 * is closed.
 */
export const IMPACT_SQL = {
  liveProductsByDependency: `
SELECT 'aliexpress_auto_buy' AS "dependency", count(*)::int AS "n"
  FROM "Product" p JOIN "SupplierLink" l ON l."productId" = p."id"
 WHERE p."active" AND l."isActive" AND l."autoBuyEnabled"
UNION ALL
SELECT 'engine_' || lower(coalesce(p."fulfillmentChannel"::text, 'ALIEXPRESS (inferred)')), count(*)::int
  FROM "Product" p
 WHERE p."active" AND p."autoFulfill"
   AND (p."fulfillmentChannel" IN ('ALIEXPRESS', 'CJ_DROPSHIPPING', 'BLIND_REST')
        OR (p."fulfillmentChannel" IS NULL AND p."aliexpressProductId" IS NOT NULL))
 GROUP BY 1
UNION ALL
SELECT 'china_agent', count(*)::int FROM "Product" p WHERE p."active" AND p."chinaBuyingAgentId" IS NOT NULL`,
  paidOrdersWaiting: `
SELECT count(*)::int AS "n", coalesce(sum(o."sellingPriceCents"), 0)::bigint AS "cents", min(o."createdAt") AS "oldest"
  FROM "Order" o JOIN "Product" p ON p."id" = o."productId"
  LEFT JOIN "SupplierLink" l ON l."productId" = p."id"
 WHERE o."status" = 'paid' AND o."supplierOrderId" IS NULL AND o."createdAt" > now() - interval '60 days'
   AND ((l."isActive" AND l."autoBuyEnabled")
        OR (p."autoFulfill" AND (p."fulfillmentChannel" IN ('ALIEXPRESS', 'CJ_DROPSHIPPING', 'BLIND_REST')
                                 OR (p."fulfillmentChannel" IS NULL AND p."aliexpressProductId" IS NOT NULL)))
        OR p."chinaBuyingAgentId" IS NOT NULL)`,
  pendingWork: `
SELECT 'fulfillment_log_' || lower("status"::text) AS "what", count(*)::int AS "n" FROM "FulfillmentLog"
 WHERE "status" IN ('PENDING', 'BUYING') GROUP BY 1
UNION ALL
SELECT 'auto_fulfillment_batch_' || lower("status"::text), count(*)::int FROM "AutoFulfillmentBatch"
 WHERE "status" IN ('PENDING', 'PROCESSING') GROUP BY 1
UNION ALL
SELECT 'blind_dropship_' || "status", count(*)::int FROM "BlindDropshipOrder"
 WHERE "status" IN ('paid', 'fulfilling') GROUP BY 1`,
} as const
