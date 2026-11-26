import { redirect } from "next/navigation"

import { auth } from "@/auth"
import type { CatalogOpportunity } from "@/lib/strategic-intelligence/catalog-opportunities"
import { loadCatalogOpportunities } from "@/lib/strategic-intelligence/catalog-opportunities.server"

export const dynamic = "force-dynamic"

const KIND: Record<CatalogOpportunity["kind"], { title: string; action: string }> = {
  under_supplied: { title: "Offre insuffisante", action: "Recruter des fournisseurs dans cette catégorie" },
  demand_on_unavailable: { title: "Demande sur des produits indisponibles", action: "Faire réassortir, trouver une autre source ou un produit équivalent" },
  under_distributed: { title: "Offre peu distribuée", action: "Recruter ou activer des revendeurs sur cette offre" },
}

const EVIDENCE: Record<string, string> = {
  orders30d: "commandes payées (30 j)",
  resellers: "revendeurs ayant vendu",
  sellableProducts: "produits vendables aujourd'hui",
  sellableSuppliers: "fournisseurs avec un produit vendable",
  ordersOnUnsellable30d: "commandes sur des produits invendables aujourd'hui",
  sharePct: "% de la demande de la catégorie",
  sellableNotListed: "produits vendables proposés par aucun revendeur",
  unlistedPct: "% de l'offre vendable non distribuée",
}

/** ADMIN — supply ↔ demand opportunities by category. Aggregates only; leads, never a market size. */
export default async function AdminCatalogOpportunitiesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/catalog-opportunities")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")
  const r = await loadCatalogOpportunities()
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Opportunités offre ↔ demande</h1>
        <p className="text-sm text-zinc-600">
          Par catégorie racine, à partir des commandes payées des 30 derniers jours, de l&apos;offre vendable aujourd&apos;hui et des demandes de produits.
          Ce sont des pistes à vérifier (recrutement de fournisseurs, réassort, distribution), jamais une taille de marché. Aucun fournisseur ni revendeur n&apos;est nommé.
        </p>
        {r.truncated ? <p className="text-sm text-amber-700">Lecture plafonnée : aucun classement n&apos;est produit (il serait partiel).</p> : null}
      </header>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Catégories ({r.categoriesJudged} examinées)</h2>
        {r.opportunities.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucune opportunité ne dépasse les seuils minimaux.</p>
        ) : (
          <ul className="space-y-2">
            {r.opportunities.map((o) => (
              <li key={`${o.kind}:${o.rootId}`} className="rounded-xl border border-zinc-200 p-3 text-sm">
                <p className="font-medium">
                  {KIND[o.kind].title} — {o.label}{" "}
                  <span className="text-xs text-zinc-500">(confiance {o.confidence === "medium" ? "moyenne" : "faible"})</span>
                </p>
                <p className="text-zinc-700">{KIND[o.kind].action}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {Object.entries(o.evidence)
                    .filter(([k, v]) => !(k === "resellers" && v === 0))
                    .map(([k, v]) => `${v} ${EVIDENCE[k] ?? k}`)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Demandes de revendeurs sans devis (≥ 7 jours)</h2>
        {r.unansweredRequests.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucune catégorie ne dépasse le seuil (≥ 3 demandes de ≥ 2 revendeurs).</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {r.unansweredRequests.map((u) => (
              <li key={u.category}>
                « {u.category} » : {u.requests} demandes, {u.resellers} revendeurs
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">Devis au-dessus du prix cible</h2>
        {r.priceGaps.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun écart notable.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {r.priceGaps.map((g) => (
              <li key={g.category}>
                « {g.category} » : {g.requests} demandes, écart médian +{g.medianGapPct} %
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
