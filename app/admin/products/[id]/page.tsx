import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { ProductSupplierLinkPanel } from "@/components/admin/product-supplier-link-panel"
import { auth } from "@/auth"
import { loadAdminProductSupplierLink } from "@/lib/admin/products/load-product-supplier-link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

export default async function AdminProductSupplierLinkPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/products")
  if ((session.user as { role?: string }).role !== "ADMIN") redirect("/")

  const { id } = await params
  const product = await loadAdminProductSupplierLink(id)
  if (!product) notFound()

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl space-y-6 p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Produit</p>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{product.name}</h1>
            <p className="mt-1 font-mono text-xs text-zinc-500">{product.id}</p>
          </div>
          <Link
            href="/admin/auto-fulfill"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            ← Auto-Fulfill
          </Link>
        </div>

        <ProductSupplierLinkPanel product={product} />
      </div>
    </main>
  )
}
