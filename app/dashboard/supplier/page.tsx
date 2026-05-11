import Link from "next/link"
import { redirect } from "next/navigation"
import { Package, PlusCircle, RefreshCw, RotateCcw, Store, Upload } from "lucide-react"

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
                Create a listing with images, pricing, and partner margin settings.
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
            <RotateCcw className="mt-0.5 h-5 w-5 text-violet-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Returns</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Approve requests, wait for the buyer’s tracking, confirm receipt, then mark as refunded.
              </p>
              <Link
                href="/dashboard/supplier/returns"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex")}
              >
                Open returns
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
                Manage products
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
                URL / CSV preview import, or structured Excel with category attributes.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/dashboard/supplier/import"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
                >
                  Precision import
                </Link>
                <Link
                  href="/dashboard/supplier/bulk-import"
                  className={cn(buttonVariants({ size: "sm" }), "inline-flex")}
                >
                  Bulk Excel
                </Link>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-700 dark:bg-zinc-900/30">
          <div className="flex items-start gap-3">
            <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-zinc-800 dark:text-zinc-100" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Platform sync</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Connect Shopify or automation tools to import your catalog as drafts.
              </p>
              <Link
                href="/dashboard/supplier/integrations"
                className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
              >
                Set up
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
