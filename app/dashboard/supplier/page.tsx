import Link from "next/link"
import { redirect } from "next/navigation"
import { Package, PlusCircle, RefreshCw, RotateCcw, Store, Upload } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell, bentoGrid } from "@/components/affisell/bento-ui"
import { auth } from "@/auth"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-8">
        <BentoPageHeading
          eyebrow="Your tools"
          title="Operations hub"
          description="Manage your Affisell catalog, storefront, returns, and bulk tools from one calm surface."
        />

        <div className={cn(bentoGrid, "auto-rows-fr")}>
          <BentoCard className="flex flex-col gap-4 xl:col-span-5">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED]">
                <PlusCircle className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Add product</h2>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  Create a listing with images, pricing in your store currency, and partner margin settings.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/supplier/products/new"
              className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }), "mt-auto inline-flex w-full justify-center sm:w-auto")}
            >
              <PlusCircle className="size-5" aria-hidden />
              New listing
            </Link>
          </BentoCard>

          <BentoCard className="flex flex-col gap-4 xl:col-span-7">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-white">
                <RotateCcw className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Returns</h2>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  Approve requests, wait for buyer tracking, confirm receipt, then mark refunded.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/supplier/returns"
              className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "mt-auto inline-flex w-full justify-center sm:w-auto")}
            >
              Open returns
            </Link>
          </BentoCard>

          <BentoCard className="flex flex-col gap-4 xl:col-span-7">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED]">
                <Package className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Products</h2>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  View and edit everything you sell on the marketplace.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/supplier/products"
              className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "mt-auto inline-flex w-full justify-center sm:w-auto")}
            >
              Manage products
            </Link>
          </BentoCard>

          <BentoCard className="flex flex-col gap-4 xl:col-span-5">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED]">
                <Upload className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Import</h2>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  URL / CSV preview, or structured Excel with category attributes.
                </p>
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/supplier/import"
                className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "inline-flex flex-1 justify-center")}
              >
                Precision import
              </Link>
              <Link
                href="/dashboard/supplier/bulk-import"
                className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex flex-1 justify-center")}
              >
                Bulk Excel
              </Link>
            </div>
          </BentoCard>

          <BentoCard className="flex flex-col gap-4 border-dashed border-gray-200/90 bg-white/60 xl:col-span-6 dark:border-zinc-700 dark:bg-zinc-900/40">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900">
                <RefreshCw className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Platform sync</h2>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  Connect Shopify or automation tools to import your catalog as drafts.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/supplier/integrations"
              className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "mt-auto inline-flex w-full justify-center sm:w-auto")}
            >
              Set up integrations
            </Link>
          </BentoCard>

          <BentoCard className="flex flex-col gap-4 xl:col-span-6">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#7C3AED]/10 text-[#7C3AED]">
                <Store className="size-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Store profile</h2>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                  Branding, social links, and public storefront.
                </p>
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/supplier/settings/store"
                className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }), "inline-flex flex-1 justify-center")}
              >
                Store settings
              </Link>
              <Link
                href="/dashboard/supplier/storefront"
                className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }), "inline-flex flex-1 justify-center")}
              >
                Visual storefront
              </Link>
            </div>
          </BentoCard>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
