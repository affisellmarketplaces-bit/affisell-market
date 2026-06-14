import Link from "next/link"
import { Landmark, Layers, Plug, Puzzle, Upload } from "lucide-react"
import { getTranslations } from "next-intl/server"

import {
  missionControlAffisellMuted,
  missionControlChip,
  missionControlDivider,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
import { cn } from "@/lib/utils"

const toolKeys = [
  { key: "import" as const, href: "/dashboard/supplier/import", Icon: Upload },
  { key: "extension" as const, href: "/dashboard/supplier/extension", Icon: Puzzle },
  { key: "finances" as const, href: "/dashboard/supplier/balance", Icon: Landmark },
  { key: "integrations" as const, href: "/dashboard/supplier/integrations", Icon: Plug },
  { key: "supply" as const, href: "/dashboard/supplier/supply", Icon: Layers },
]

export async function SupplierToolsRow() {
  const t = await getTranslations("supplierDashboard.tools")

  return (
    <section aria-labelledby="tools-heading" className={cn("space-y-3 border-t pt-6", missionControlDivider)}>
      <h2 id="tools-heading" className={cn("text-xs font-semibold uppercase tracking-[0.14em]", missionControlAffisellMuted)}>
        {t("title")}
      </h2>
      <div className="flex flex-wrap gap-2">
        {toolKeys.map(({ key, href, Icon }) => (
          <Link key={key} href={href} className={cn("inline-flex items-center gap-2", missionControlChip)}>
            <Icon className="h-4 w-4 shrink-0 text-violet-500 dark:text-violet-300" aria-hidden />
            {t(key)}
          </Link>
        ))}
      </div>
    </section>
  )
}
