import Link from "next/link"
import { Plus } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
}

export function SupplierMissionControlHeader({ storeName }: Props) {
  return (
    <header className="flex flex-col gap-4 border-b border-zinc-200/80 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Mission Control</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Bonjour {storeName}
        </h1>
      </div>
      <Link
        href="/dashboard/supplier/products/new"
        className={cn(
          buttonVariants({ size: "default" }),
          "inline-flex shrink-0 items-center justify-center gap-2 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600"
        )}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Nouveau produit
      </Link>
    </header>
  )
}
