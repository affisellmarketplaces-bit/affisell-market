import Link from "next/link"

import { DeliveryBadge } from "@/components/logistics/DeliveryBadge"
import { GlobalRequestButton } from "@/components/reseller/GlobalRequestButton"
import { requireAffiliateSession } from "@/lib/dashboard-session"
import { formatRequestRelativeFr } from "@/lib/product-request-types"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function ResellerRequestsPage() {
  const session = await requireAffiliateSession("/dashboard/reseller/requests")

  const rows = await prisma.productRequest.findMany({
    where: { resellerId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] bg-zinc-50/80 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-zinc-900">Mes demandes produits</h1>
          <GlobalRequestButton variant="primary" label="Nouvelle demande" />
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-orange-200 bg-gradient-to-b from-orange-50 to-white px-6 py-12 text-center shadow-sm">
            <p className="text-lg font-bold text-zinc-900">Aucune demande — Crée ta première</p>
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-600">
              Comment ça marche?
            </p>
            <ol className="mx-auto mt-3 max-w-sm space-y-1.5 text-left text-sm text-zinc-700">
              <li>
                <strong>1.</strong> Tu demandes un produit introuvable
              </li>
              <li>
                <strong>2.</strong> Fournisseurs devisent en &lt;2h
              </li>
              <li>
                <strong>3.</strong> Tu compares et choisis
              </li>
              <li>
                <strong>4.</strong> Produit créé auto dans ton catalogue
              </li>
            </ol>
            <div className="mt-6">
              <GlobalRequestButton variant="primary" label="+ Demander un produit" />
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/reseller/requests/${r.id}`}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:border-violet-300"
                >
                  <div>
                    <p className="font-semibold text-zinc-900">{r.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {r.country} · {r.category} · {r.quantity} pcs ·{" "}
                      {formatRequestRelativeFr(r.createdAt)}
                      {r.quotesCount > 0 ? ` · ${r.quotesCount} devis` : ""}
                    </p>
                    {r.deliverySLA != null ? (
                      <div className="mt-1.5">
                        <DeliveryBadge days={r.deliverySLA} country={r.country} />
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      r.status === "open"
                        ? "bg-emerald-50 text-emerald-700"
                        : r.status === "fulfilled"
                          ? "bg-violet-50 text-violet-700"
                          : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {r.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
