import Link from "next/link"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default async function SupplierProductsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-zinc-600">
        <Link href="/login?callbackUrl=/dashboard/supplier/products" className="underline">
          Sign in
        </Link>{" "}
        to manage products.
      </div>
    )
  }
  if (session.user.role !== "SUPPLIER") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-zinc-600">
        Supplier access only.
      </div>
    )
  }

  const products = await prisma.product.findMany({
    where: { supplierId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      basePriceCents: true,
      commissionRate: true,
      listingKind: true,
      stock: true,
      active: true,
      updatedAt: true,
    },
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Products</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Manage catalog listings and affiliate commission.
          </p>
        </div>
        <Link href="/dashboard/supplier/products/new" className={cn(buttonVariants({ size: "sm" }), "inline-flex")}>
          Add product
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Name</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Base price</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Commission</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Type</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Stock</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Status</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300"> </th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                  No products yet.{" "}
                  <Link href="/dashboard/supplier/products/new" className="font-medium text-violet-600 underline">
                    Add your first product
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatUsd(p.basePriceCents)}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{p.commissionRate}%</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{p.listingKind}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{p.stock}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {p.active ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Active</span>
                    ) : (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/supplier/products/new?edit=${p.id}`}
                      className="text-sm font-medium text-violet-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
