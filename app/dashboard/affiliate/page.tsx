import { redirect } from "next/navigation"
import { Suspense } from "react"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { AffiliateDashboard } from "./affiliate-dashboard"

export const dynamic = "force-dynamic"

export default async function AffiliateDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/affiliate")
  if (session.user.role === "SUPPLIER") redirect("/dashboard/supplier")
  if (session.user.role !== "AFFILIATE") redirect("/marketplace")

  const [catalogProducts, listings, store] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      include: {
        affiliateProducts: {
          where: { affiliateId: session.user.id },
          select: { id: true, isListed: true },
        },
        supplier: { include: { store: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.affiliateProduct.findMany({
      where: { affiliateId: session.user.id },
      include: { product: true },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    }),
    prisma.store.findUnique({
      where: { userId: session.user.id },
      select: { slug: true },
    }),
  ])

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-gray-500 md:px-8">
          Loading affiliate dashboard…
        </div>
      }
    >
      <AffiliateDashboard
        catalog={JSON.parse(JSON.stringify(catalogProducts))}
        listings={JSON.parse(JSON.stringify(listings))}
        storeSlug={store?.slug ?? null}
        storeId={session.user.id}
      />
    </Suspense>
  )
}
