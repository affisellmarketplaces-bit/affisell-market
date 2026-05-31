import Link from "next/link"
import { redirect } from "next/navigation"

import { AdminProductCreateForm } from "@/components/admin/admin-product-create-form"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function AdminNewProductPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/products/new")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const suppliers = await prisma.user.findMany({
    where: { role: "SUPPLIER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 200,
  })

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Admin</p>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Nouveau produit AE (SKU Affisell)
            </h1>
          </div>
          <Link
            href="/admin/auto-fulfill"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            ← Auto-Fulfill
          </Link>
        </div>

        <AdminProductCreateForm suppliers={suppliers} />
      </div>
    </main>
  )
}
