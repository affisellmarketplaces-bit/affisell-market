import { auth } from "@/auth"
import { redirect } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"

import { SupplierLiveDashboard } from "./live-dashboard"

export const dynamic = "force-dynamic"

export default async function SupplierDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const sess = await auth()
  if (!sess?.user?.id) {
    redirect({ href: "/login", locale })
  }

  const user = sess.user
  if (user.role !== "SUPPLIER") {
    redirect({ href: "/dashboard/affiliate", locale })
  }

  const t = await getTranslations({ locale, namespace: "supplier" })

  const [products, orders] = await Promise.all([
    prisma.product.findMany({
      where: { supplierId: user.id },
      orderBy: { name: "asc" },
    }),
    prisma.order.findMany({
      where: { supplierId: user.id },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  type Ord = (typeof orders)[number]

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t("myProducts")}</p>
      </div>
      <SupplierLiveDashboard user={{ id: user.id, email: user.email ?? null }} products={products} />

      <section className="mx-auto mb-16 max-w-7xl px-4 md:px-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("ordersToShip")}</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("ordersEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="p-3 font-medium">{t("productCol")}</th>
                  <th className="p-3 font-medium">{t("customerEmail")}</th>
                  <th className="p-3 font-medium">{t("orderTotal")}</th>
                  <th className="p-3 font-medium">{t("shipTo")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: Ord) => (
                  <tr key={o.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="p-3">{o.product.name}</td>
                    <td className="p-3">{o.customerEmail}</td>
                    <td className="p-3 whitespace-nowrap">
                      {(o.sellingPriceCents / 100).toLocaleString("en-US", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </td>
                    <td className="p-3 max-w-md whitespace-pre-wrap text-xs">
                      {typeof o.shippingAddress === "object" && o.shippingAddress !== null
                        ? JSON.stringify(o.shippingAddress, null, 2)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
