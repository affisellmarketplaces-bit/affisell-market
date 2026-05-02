import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"

import { NewSupplierProductClient } from "./new-product-client"

export default async function NewSupplierProductPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login?callbackUrl=/supplier/products/new")
  if (session.user.role === "AFFILIATE") redirect("/dashboard/affiliate")
  if (session.user.role !== "SUPPLIER") redirect("/marketplace")

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <Link
        href="/dashboard/supplier"
        className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400"
      >
        ← Back to supplier dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">New product</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Professional attributes, categories, colors, and variants are saved with your catalog entry.
      </p>
      <div className="mt-8">
        <NewSupplierProductClient />
      </div>
    </div>
  )
}
