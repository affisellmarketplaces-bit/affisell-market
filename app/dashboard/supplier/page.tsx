import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ChevronRight,
  Compass,
  Package,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Store,
  Truck,
  Upload,
} from "lucide-react"

import { BentoCard, BentoContainer, BentoStat, bentoGrid } from "@/components/affisell/bento-ui"
import { auth } from "@/auth"
import { buttonVariants } from "@/components/ui/button"
import { TERMINAL_RETURN_STATUSES } from "@/lib/order-return-types"
import { countSupplierOrdersToShip } from "@/lib/supplier-orders-payload"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function DashboardSupplierPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/supplier")
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/dashboard")
  }

  const userId = session.user.id
  const [liveSkuCount, draftCount, openReturnsCount, ordersToShipCount] = await Promise.all([
    prisma.product.count({ where: { supplierId: userId, active: true, isDraft: false } }),
    prisma.product.count({ where: { supplierId: userId, isDraft: true } }),
    prisma.orderReturn.count({
      where: {
        order: { supplierId: userId },
        status: { notIn: [...TERMINAL_RETURN_STATUSES] },
      },
    }),
    countSupplierOrdersToShip(userId),
  ])

  const quickLinks = [
    { label: "Browse marketplace", href: "/marketplace", Icon: Compass },
    { label: "Orders to ship", href: "/dashboard/supplier/orders", Icon: Truck },
    { label: "All products", href: "/dashboard/supplier/products", Icon: Package },
    { label: "New listing", href: "/dashboard/supplier/products/new", Icon: PlusCircle },
    { label: "Returns inbox", href: "/dashboard/supplier/returns", Icon: RotateCcw },
    { label: "Store settings", href: "/dashboard/supplier/settings/store", Icon: Store },
    { label: "Integrations", href: "/dashboard/supplier/integrations", Icon: RefreshCw },
  ] as const

  return (
    <main className="min-h-[calc(100dvh-3.75rem)] text-gray-900 dark:text-zinc-50">
      <BentoContainer maxWidth="6xl" className="space-y-10">
          <header className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-white/85 shadow-sm shadow-violet-500/5 ring-1 ring-black/[0.03] backdrop-blur-md dark:border-violet-900/40 dark:bg-zinc-950/75 dark:ring-white/10">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.2]"
              style={{
                backgroundImage: `
                radial-gradient(ellipse 80% 55% at 15% -10%, rgba(139,92,246,0.28), transparent 50%),
                radial-gradient(ellipse 60% 45% at 92% 8%, rgba(20,184,166,0.2), transparent 45%),
                radial-gradient(circle at 50% 100%, rgba(139,92,246,0.06), transparent 55%)
              `,
              }}
              aria-hidden
            />
            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Supplier hub
                  </div>
                  <div>
                    <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                      Your operations surface
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-[15px]">
                      Publish SKUs, handle returns, sync integrations, and tune your public store—all in one calm
                      dashboard.
                    </p>
                  </div>
                  <nav className="flex flex-wrap gap-2 sm:gap-2.5" aria-label="Quick links">
                    {quickLinks.map(({ label, href, Icon }) => (
                      <Link
                        key={label}
                        href={href}
                        className="group inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white/90 px-3.5 py-2 text-left text-[13px] font-medium text-zinc-800 shadow-sm transition hover:border-violet-300/70 hover:bg-violet-50/50 hover:text-violet-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:border-violet-700 dark:hover:bg-violet-950/40 dark:hover:text-violet-100"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-100 to-teal-50 text-violet-700 dark:from-violet-950 dark:to-teal-950/50 dark:text-violet-300">
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600 dark:group-hover:text-violet-400"
                          aria-hidden
                        />
                      </Link>
                    ))}
                  </nav>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row lg:w-auto lg:flex-col xl:max-w-[280px]">
                  <Link
                    href="/dashboard/supplier/products/new"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                  >
                    <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
                    New listing
                  </Link>
                  <Link
                    href="/dashboard/supplier/products"
                    className={cn(
                      buttonVariants({ variant: "bentoOutline", size: "bento" }),
                      "inline-flex flex-1 justify-center font-semibold"
                    )}
                  >
                    Manage catalog
                  </Link>
                </div>
              </div>

              <div className="mt-8 grid gap-6 border-t border-gray-100/90 pt-8 dark:border-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
                <BentoStat
                  className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent"
                  label="To ship"
                  value={ordersToShipCount}
                  valueClassName={ordersToShipCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
                  hint={
                    ordersToShipCount > 0 ? (
                      <Link href="/dashboard/supplier/orders" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-400">
                        Open fulfillment queue →
                      </Link>
                    ) : (
                      "New paid orders appear here"
                    )
                  }
                />
                <BentoStat
                  className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent"
                  label="Live on marketplace"
                  value={
                    <>
                      {liveSkuCount}
                      <span className="ml-1 text-base font-medium text-gray-500 dark:text-zinc-400">SKUs</span>
                    </>
                  }
                  hint={draftCount > 0 ? `${draftCount} draft${draftCount === 1 ? "" : "s"} not published yet` : "Published & active listings"}
                />
                <BentoStat
                  className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent"
                  label="Drafts"
                  value={draftCount}
                  hint="Finish and publish when you are ready"
                />
                <BentoStat
                  className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent"
                  label="Returns in progress"
                  value={openReturnsCount}
                  valueClassName={openReturnsCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
                  hint={openReturnsCount > 0 ? "Needs your attention in Returns" : "No open return cases"}
                />
              </div>
            </div>
          </header>

          <section className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
              Tools & workflows
            </p>
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
                  className={cn(
                    buttonVariants({ variant: "bentoAccent", size: "bento" }),
                    "mt-auto inline-flex w-full justify-center sm:w-auto"
                  )}
                >
                  <PlusCircle className="size-5" aria-hidden />
                  New listing
                </Link>
              </BentoCard>

              <BentoCard className="flex flex-col gap-4 xl:col-span-5">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    <Truck className="size-6" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Orders to ship</h2>
                    <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400">
                      Paid marketplace orders with buyer shipping addresses.
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/supplier/orders"
                  className={cn(
                    buttonVariants({ variant: "bentoAccent", size: "bento" }),
                    "mt-auto inline-flex w-full justify-center sm:w-auto"
                  )}
                >
                  <Truck className="size-5" aria-hidden />
                  Fulfillment queue{ordersToShipCount > 0 ? ` (${ordersToShipCount})` : ""}
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
                  className={cn(
                    buttonVariants({ variant: "bentoOutline", size: "bento" }),
                    "mt-auto inline-flex w-full justify-center sm:w-auto"
                  )}
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
                  className={cn(
                    buttonVariants({ variant: "bentoOutline", size: "bento" }),
                    "mt-auto inline-flex w-full justify-center sm:w-auto"
                  )}
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
                    className={cn(
                      buttonVariants({ variant: "bentoOutline", size: "bento" }),
                      "inline-flex flex-1 justify-center"
                    )}
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
                  className={cn(
                    buttonVariants({ variant: "bentoSolid", size: "bento" }),
                    "mt-auto inline-flex w-full justify-center sm:w-auto"
                  )}
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
                    className={cn(
                      buttonVariants({ variant: "bentoOutline", size: "bento" }),
                      "inline-flex flex-1 justify-center"
                    )}
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
          </section>
      </BentoContainer>
    </main>
  )
}
