import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { ConfirmButton } from "./confirm-button"

export default async function OrdersPage() {
  const session = await auth()
  const userId = session?.user?.id
  
  if (!userId) {
    return <div className="p-8">Connecte-toi pour voir tes commandes</div>
  }

  const orders = await prisma.order.findMany({
    where: { userId, status: 'PAID' },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mes commandes</h1>
      {orders.length === 0 ? (
        <p>Aucune commande payée</p>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="border p-4 mb-4 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">{(o.amount/100).toFixed(2)} {o.currency.toUpperCase()}</p>
                <p className="text-sm text-gray-600">
                  {o.confirmedAt 
                    ? `Confirmée le ${new Date(o.confirmedAt).toLocaleDateString()} - libération ${new Date(o.deliverableAt).toLocaleDateString()}`
                    : `Non confirmée - libération prévue ${new Date(o.deliverableAt).toLocaleDateString()} (J+10)`
                  }
                </p>
              </div>
              {!o.confirmedAt && <ConfirmButton orderId={o.id} />}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
