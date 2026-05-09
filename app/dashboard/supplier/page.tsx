import Link from "next/link"
import { redirect } from "next/navigation"
import { Package, PlusCircle, Store, Upload } from "lucide-react"

import { auth } from "@/auth"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

export const dynamic = "force-dynamic"

export default async function DashboardSupplierPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/supplier")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/dashboard")
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Supplier dashboard</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Manage your Affisell catalog, storefront, and bulk tools.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="border-zinc-200 p-5 dark:border-zinc-700">
          <div className="flex items-start gap-3">
            <PlusCircle className="mt-0.5 h-5 w-5 text-violet-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Add product</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Create a listing with images, pricing, and affiliate commission.
              </p>
              <Link
                href="/dashboard/supplier/products/new"
                className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
              >
                Open
              </Link>
            </div>
          </div>
        </Card>

        <Card className="border-zinc-200 p-5 dark:border-zinc-700">
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 h-5 w-5 text-violet-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Products</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                View and edit everything you sell on the marketplace.
              </p>
              <Link
                href="/dashboard/supplier/products"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex")}
              >
                View catalog
              </Link>
            </div>
          </div>
        </Card>

        <Card className="border-zinc-200 p-5 dark:border-zinc-700">
          <div className="flex items-start gap-3">
            <Upload className="mt-0.5 h-5 w-5 text-violet-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Import</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Bulk upload from CSV or integrations.
              </p>
              <Link
                href="/dashboard/supplier/import"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex")}
              >
                Go to import
              </Link>
            </div>
          </div>
        </Card>

        <Card className="border-zinc-200 p-5 dark:border-zinc-700">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 h-5 w-5 text-violet-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Store profile</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Branding, social links, and public storefront.
              </p>
              <Link
                href="/dashboard/supplier/settings/store"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex")}
              >
                Settings
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
