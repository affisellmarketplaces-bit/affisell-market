import Link from "next/link"
import { Landmark, Layers, Package, Plug, Puzzle, Upload } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { cn } from "@/lib/utils"

const toolKeys = [
  { key: "catalog" as const, href: "/dashboard/supplier/products", Icon: Package },
  { key: "import" as const, href: "/dashboard/supplier/import", Icon: Upload },
  { key: "extension" as const, href: "/dashboard/supplier/extension", Icon: Puzzle },
  { key: "finances" as const, href: "/dashboard/supplier/balance", Icon: Landmark },
  { key: "integrations" as const, href: "/dashboard/supplier/integrations", Icon: Plug },
  { key: "supply" as const, href: "/dashboard/supplier/supply", Icon: Layers },
]

export async function SupplierToolsRow() {
  const t = await getTranslations("supplierDashboard.tools")

  return (
    <section aria-labelledby="tools-heading" className="space-y-3 border-t border-zinc-200/80 pt-6 dark:border-zinc-800">
      <h2 id="tools-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {t("title")}
      </h2>
      <div className="flex flex-wrap gap-2">
        {toolKeys.map(({ key, href, Icon }) => (
          <Link
            key={key}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-violet-800 dark:hover:bg-violet-950/30"
            )}
          >
            <Icon className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
            {t(key)}
          </Link>
        ))}
      </div>
    </section>
  )
}
