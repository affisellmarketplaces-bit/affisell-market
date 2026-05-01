import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ConfirmButton } from "./confirm-button"

export default async function OrdersPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/api/auth/signin")
  }
  const userId = session.user.id

  const orders = await prisma.order.findMany({
    where: { userId, status: { in: ["PAID", "PENDING"] } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mes commandes</h1>
      {orders.length === 0 ? (
        <p>Aucune commande</p>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="border p-4 mb-4 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">
                  {(o.amount / 100).toFixed(2)} {o.currency.toUpperCase()}
                  {o.status === "PENDING" ? (
                    <span className="ml-2 text-sm font-normal text-amber-600">
                      (en attente de confirmation)
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-gray-600">
                  {o.status === "PENDING"
                    ? "Le statut passe à « payé » après confirmation Stripe (webhook)."
                    : o.confirmedAt
                      ? `Confirmée le ${new Date(o.confirmedAt).toLocaleDateString()} - libération ${
                          o.deliverableAt
                            ? new Date(o.deliverableAt).toLocaleDateString()
                            : "—"
                        }`
                      : `Non confirmée - libération prévue ${
                          o.deliverableAt
                            ? new Date(o.deliverableAt).toLocaleDateString()
                            : "—"
                        } (libération prévue après confirmation)`}
                </p>
              </div>
              {o.status === "PAID" && !o.confirmedAt ? (
                <ConfirmButton orderId={o.id} />
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
