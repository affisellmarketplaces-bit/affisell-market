/** Affisell Ing — static brain (architecture + ops rules). */
export const AFFISELL_CONTEXT = `
- Architecture: 1 Order = 1 produit, groupé par stripeSessionId + supplierId en FulfillmentGroup
- Stack: Next.js 16, Prisma, Neon (pooler true pour read, false pour fulfillment writes), Shopify + Woo ck/cs Clone & Own
- 98 FulfillmentGroups migrés, metric manual_required normal si Product.sourceIntegrationId null
- Fichiers critiques: lib/fulfillment/orchestrator.ts, lib/integrations/providers/*.provider.ts, lib/prisma.ts, lib/ensure-database-url-unpooled.ts
- Ne jamais utiliser pooler pour writes fulfillment, toujours sequential + delay 100ms pour migrate
- Supplier flow: /dashboard/supplier/integrations -> Connect -> Sync -> Product avec sourceIntegrationId -> auto-buy
- Logs métier: [fulfillment-orchestrator] manual_required, auto_buy_async_failed, [prisma] Engine was empty
`.trim()
