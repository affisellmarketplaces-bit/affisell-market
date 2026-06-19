import { prisma } from "@/lib/prisma"

async function main() {
  const storeName = process.argv[2] ?? "BigDeals"

  if (storeName === "--recent") {
    const recent = await prisma.order.findMany({
      where: { status: { in: ["paid", "preparing", "PENDING"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        createdAt: true,
        supplierId: true,
        product: { select: { name: true, supplierId: true } },
        supplier: { select: { email: true, store: { select: { name: true } } } },
      },
    })
    console.log("[diagnose-supplier-notifications]", {
      recentOrders: recent.map((o) => ({
        id: o.id,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        product: o.product.name,
        supplierStore: o.supplier.store?.name ?? o.supplier.email,
        supplierId: o.supplierId,
      })),
    })
    return
  }

  const store = await prisma.store.findFirst({
    where: { name: { contains: storeName, mode: "insensitive" } },
    select: {
      userId: true,
      name: true,
      slug: true,
      user: { select: { email: true, role: true } },
    },
  })

  console.log("[diagnose-supplier-notifications]", { store })
  if (!store) return

  const supplierId = store.userId
  const lookback = new Date(Date.now() - 7 * 86_400_000)

  const orders = await prisma.order.findMany({
    where: { supplierId, status: { in: ["paid", "preparing", "shipped", "PENDING"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      createdAt: true,
      paidAt: true,
      merchantSupplierInboxNotifiedAt: true,
      product: { select: { name: true } },
    },
  })

  const notifs = await prisma.notification.findMany({
    where: { userId: supplierId, type: "NEW_ORDER" },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, orderId: true, read: true, createdAt: true },
  })

  const notifiedOrderIds = new Set(
    notifs.map((n) => n.orderId).filter((id): id is string => Boolean(id))
  )

  const missing = orders.filter(
    (o) =>
      ["paid", "preparing", "shipped"].includes(o.status) &&
      o.createdAt >= lookback &&
      !notifiedOrderIds.has(o.id)
  )

  console.log("[diagnose-supplier-notifications]", {
    supplierId,
    orderCount: orders.length,
    notificationCount: notifs.length,
    missingAlertCount: missing.length,
    unreadCount: notifs.filter((n) => !n.read).length,
    latestOrderAt: orders[0]?.createdAt.toISOString() ?? null,
    latestNotifAt: notifs[0]?.createdAt.toISOString() ?? null,
    recentOrders: orders.slice(0, 5).map((o) => ({
      id: o.id,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      product: o.product.name,
      merchantSupplierInboxNotifiedAt: o.merchantSupplierInboxNotifiedAt,
      hasNotificationRow: notifiedOrderIds.has(o.id),
    })),
    recentNotifs: notifs.slice(0, 5).map((n) => ({
      orderId: n.orderId,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    missingAlerts: missing.map((o) => ({
      id: o.id,
      status: o.status,
      product: o.product.name,
      flagSet: Boolean(o.merchantSupplierInboxNotifiedAt),
    })),
  })
}

main()
  .catch((error) => {
    console.error("[diagnose-supplier-notifications]", {
      error: error instanceof Error ? error.message : String(error),
    })
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
