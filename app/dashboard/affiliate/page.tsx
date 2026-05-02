import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

import { AffiliateDashboard } from "./affiliate-dashboard"

export const dynamic = "force-dynamic"

export default async function AffiliateDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/affiliate")
  if (session.user.role === "SUPPLIER") redirect("/dashboard/supplier")
  if (session.user.role !== "AFFILIATE") redirect("/marketplace")

  const [catalog, listings] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      include: { supplier: { select: { email: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.affiliateProduct.findMany({
      where: { affiliateId: session.user.id },
      include: { product: true },
      orderBy: { id: "desc" },
    }),
  ])

  return (
    <AffiliateDashboard
      catalog={JSON.parse(JSON.stringify(catalog))}
      listings={JSON.parse(JSON.stringify(listings))}
    />
  )
}
