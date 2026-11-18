/**
 * READ-ONLY inventory of the reseller URL imports made before the validation flow (2026-11-18) — products imported by
 * resellers that no admin ever reviewed (`importSource = reseller_url_import`, no `import-review:*` tag). Counts,
 * status, source sites, sales and risks; aggregates only (no product, reseller or buyer identifier is printed).
 * Changes NOTHING: regularisation (approve / reject in /admin/reseller-imports) is a founder decision.
 *
 *   npm run report:legacy-reseller-imports -- --target                         # database + tables + guarantees, no connection
 *   npm run report:legacy-reseller-imports -- --confirm-endpoint=<ep-id>       # required on production
 *   options: --json
 */
import type { Prisma } from "@prisma/client"

import { runReadOnlyReport } from "./lib/read-only-report"

import { LISTING_COMPLIANCE_KEYS } from "../lib/listing-compliance/keys"
import { summarizeLegacyImports, type LegacyImportInventory, type LegacyImportRow } from "../lib/reseller-import/legacy-inventory"
import { IMPORT_REVIEW_TAG_PREFIX, IMPORT_REVIEW_STATES, RESELLER_URL_IMPORT_SOURCE_VALUE } from "../lib/reseller-import/review"

const asJson = process.argv.includes("--json")
const BATCH = 200
const LIMIT = 20_000

async function collect(tx: Prisma.TransactionClient): Promise<{ inventory: LegacyImportInventory; truncated: boolean }> {
  const since90 = new Date(Date.now() - 90 * 86_400_000)
  const reviewTags = IMPORT_REVIEW_STATES.map((s) => `${IMPORT_REVIEW_TAG_PREFIX}${s}`)
  const rows: LegacyImportRow[] = []
  let cursor: string | undefined
  for (;;) {
    const batch = await tx.product.findMany({
      where: { importSource: RESELLER_URL_IMPORT_SOURCE_VALUE, NOT: { tags: { hasSome: reviewTags } } },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        createdAt: true,
        active: true,
        isDraft: true,
        listingKind: true,
        sourceUrl: true,
        basePriceCents: true,
        stock: true,
        images: true,
        description: true,
        attributes: { where: { key: { in: [...LISTING_COMPLIANCE_KEYS] } }, select: { key: true, value: true } },
        affiliateProducts: { select: { isListed: true, affiliateId: true } },
      },
    })
    if (batch.length === 0) break
    cursor = batch[batch.length - 1]!.id
    const ids = batch.map((p) => p.id)
    const [recent, allTime, recalls] = await Promise.all([
      tx.order.groupBy({ by: ["productId"], where: { productId: { in: ids }, paidAt: { gte: since90 } }, _count: { _all: true } }),
      tx.order.groupBy({ by: ["productId"], where: { productId: { in: ids }, paidAt: { not: null } }, _count: { _all: true } }),
      tx.productRecall.groupBy({ by: ["productId"], where: { productId: { in: ids }, status: { not: "closed" } }, _count: { _all: true } }),
    ])
    const count = (list: Array<{ productId: string; _count: { _all: number } }>) =>
      new Map(list.map((r) => [r.productId, r._count._all]))
    const recentBy = count(recent)
    const allBy = count(allTime)
    const recallBy = count(recalls)
    for (const p of batch) {
      rows.push({
        createdAt: p.createdAt,
        active: p.active,
        isDraft: p.isDraft,
        listingKind: p.listingKind,
        sourceUrl: p.sourceUrl,
        basePriceCents: p.basePriceCents,
        stock: p.stock,
        imageCount: p.images.length,
        descriptionLength: p.description.replace(/<[^>]*>/g, "").trim().length,
        attributes: p.attributes,
        listings: p.affiliateProducts,
        paidOrders90d: recentBy.get(p.id) ?? 0,
        paidOrdersAllTime: allBy.get(p.id) ?? 0,
        openRecalls: recallBy.get(p.id) ?? 0,
      })
    }
    if (rows.length >= LIMIT) break
  }
  return { inventory: summarizeLegacyImports(rows), truncated: rows.length >= LIMIT }
}

function print({ inventory: i, truncated }: { inventory: LegacyImportInventory; truncated: boolean }) {
  if (asJson) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), truncated, ...i }, null, 2))
    return
  }
  console.log(`\nAnciens imports revendeurs jamais validés — ${new Date().toISOString()}${truncated ? " (LECTURE TRONQUÉE)" : ""}`)
  console.log(`  Produits : ${i.products} (en ligne ${i.live}, brouillon / en pause ${i.draftOrPaused})`)
  console.log(`  Annonces : ${i.listings} (visibles ${i.listedListings}) chez ${i.resellers} revendeur(s)`)
  console.log(`  Ventes   : ${i.soldIn90d.products} produit(s) vendu(s) sur 90 j (${i.soldIn90d.orders} commandes payées) ; ${i.paidOrdersAllTime} commandes payées au total`)
  console.log("  Sites d'origine (produits / en ligne) :")
  for (const h of i.bySourceHost) console.log(`    ${h.host.padEnd(32)} ${String(h.products).padStart(5)} / ${h.live}`)
  console.log("  Mois d'import :")
  for (const m of i.byImportMonth) console.log(`    ${m.month}  ${m.products}`)
  console.log("  Risques sur les produits EN LIGNE :")
  const r = i.risks
  console.log(`    sans données de sécurité produit obligatoires : ${r.liveWithoutSafetyData}`)
  console.log(`    avec un rappel produit ouvert                 : ${r.liveWithOpenRecall}`)
  console.log(`    sans photo                                    : ${r.liveWithoutImage}`)
  console.log(`    stock de remplissage (1 / 99 / 100 / 999)     : ${r.liveWithPlaceholderStock}`)
  console.log(`    description vide ou quasi vide                : ${r.liveWithEmptyDescription}`)
  console.log(`    prix nul                                      : ${r.liveWithZeroPrice}`)
  console.log(`    source inconnue                               : ${r.liveFromUnknownSource}`)
  console.log("\n  Rien n'a été modifié. Régularisation : /admin/reseller-imports (décision du fondateur).\n")
}

runReadOnlyReport(
  {
    tables: ["Product", "ProductAttribute (clés de conformité)", "AffiliateProduct", "Order (comptages)", "ProductRecall (comptages)"],
    purpose: "inventaire des imports revendeurs antérieurs au 18/11/2026, jamais validés",
  },
  collect,
  print
).catch((e) => {
  console.error("report failed:", e instanceof Error ? e.message : e)
  process.exitCode = 1
})
