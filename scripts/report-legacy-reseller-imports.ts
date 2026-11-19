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
import { runReadOnlyReport } from "./lib/read-only-report"

import { type LegacyImportInventory } from "../lib/reseller-import/legacy-inventory"
import { collectLegacyResellerImports } from "../lib/reports/legacy-reseller-imports-report"

const asJson = process.argv.includes("--json")

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
  (tx) => collectLegacyResellerImports(tx),
  print
).catch((e) => {
  console.error("report failed:", e instanceof Error ? e.message : e)
  process.exitCode = 1
})
