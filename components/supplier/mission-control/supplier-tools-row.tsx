import Link from "next/link"
import { Flame, Landmark, Layers, Plug, Puzzle, Sparkles, Upload } from "lucide-react"
import { getTranslations } from "next-intl/server"

import {
  missionControlAffisellMuted,
  missionControlChip,
  missionControlDivider,
  missionControlIconMuted,
} from "@/components/supplier/mission-control/mission-control-affisell-shell"
import { DROPFORGE_HREF } from "@/lib/affiliate-onboarding-shared"
import { MAGIC_SYSTEMS_HREF } from "@/lib/magic-systems-catalog"
import { cn } from "@/lib/utils"

const toolKeys = [
  { key: "supply" as const, href: "/dashboard/supplier/supply#affisell-stock", Icon: Layers },
  { key: "dropforge" as const, href: DROPFORGE_HREF, Icon: Flame },
  { key: "magicLab" as const, href: MAGIC_SYSTEMS_HREF, Icon: Sparkles },
  { key: "import" as const, href: "/dashboard/supplier/import", Icon: Upload },
  { key: "extension" as const, href: "/dashboard/supplier/extension", Icon: Puzzle },
  { key: "finances" as const, href: "/dashboard/supplier/balance", Icon: Landmark },
  { key: "integrations" as const, href: "/dashboard/supplier/integrations", Icon: Plug },
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
          <Link
            key={key}
            href={href}
            className={cn(
              "group inline-flex items-center gap-2",
              missionControlChip,
              key === "supply" &&
                "border-sky-300/70 bg-sky-50 text-sky-950 ring-1 ring-sky-400/25 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-50 dark:ring-sky-400/25",
              key === "dropforge" &&
                "border-violet-300/70 bg-violet-50 text-violet-950 ring-1 ring-violet-400/25 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-50 dark:ring-violet-400/25"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                key === "supply"
                  ? "text-sky-700 dark:text-sky-300"
                  : key === "dropforge"
                    ? "text-violet-700 dark:text-violet-300"
                    : missionControlIconMuted
              )}
              aria-hidden
            />
            {t(key)}
          </Link>
        ))}
      </div>
    </section>
  )
}
