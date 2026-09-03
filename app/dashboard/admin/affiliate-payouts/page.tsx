import type { Metadata } from "next"

import {
  rejectAffiliatePayoutMethodAction,
  verifyAffiliatePayoutMethodAction,
} from "@/app/dashboard/admin/affiliate-payouts/actions"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Affiliate Payouts | Affisell Admin",
  robots: { index: false, follow: false },
}

export default async function AdminAffiliatePayoutsPage() {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    redirect(gate.status === 401 ? "/login/admin?callbackUrl=/dashboard/admin/affiliate-payouts" : "/")
  }

  const methods = await prisma.affiliatePayoutMethod.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      affiliate: { select: { email: true, name: true } },
    },
  })

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
        Affiliate Payouts — Validation
      </h1>
      <p className="mt-1 text-gray-500 dark:text-zinc-400">{methods.length} méthodes</p>
      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-gray-50 dark:bg-zinc-900/80">
              <tr>
                <th className="p-3 text-left font-medium">Affilié</th>
                <th className="p-3 text-left font-medium">Type</th>
                <th className="p-3 text-left font-medium">Pays</th>
                <th className="p-3 text-left font-medium">Last4</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Default</th>
                <th className="p-3 text-left font-medium">Date</th>
                <th className="p-3 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => (
                <tr key={method.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="p-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {method.affiliate.email}
                    </div>
                    {method.affiliate.name ? (
                      <div className="text-xs text-gray-500 dark:text-zinc-400">
                        {method.affiliate.name}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3">{method.type}</td>
                  <td className="p-3">{method.country}</td>
                  <td className="p-3">{method.last4 ?? "—"}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        method.status === "VERIFIED"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : method.status === "FAILED"
                            ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}
                    >
                      {method.status}
                    </span>
                  </td>
                  <td className="p-3">{method.isDefault ? "⭐" : ""}</td>
                  <td className="p-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {new Date(method.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {method.status !== "VERIFIED" ? (
                        <form action={verifyAffiliatePayoutMethodAction}>
                          <input type="hidden" name="id" value={method.id} />
                          <button
                            type="submit"
                            className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                          >
                            Verify
                          </button>
                        </form>
                      ) : null}
                      <form action={rejectAffiliatePayoutMethodAction}>
                        <input type="hidden" name="id" value={method.id} />
                        <button
                          type="submit"
                          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {methods.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">Aucune méthode en attente.</p>
        ) : null}
      </div>
    </div>
  )
}
