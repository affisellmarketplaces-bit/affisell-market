import Link from "next/link"
import { Eye, LayoutDashboard } from "lucide-react"

import { AFFILIATE_CATALOG_PATH } from "@/lib/affiliate-routes"

type Props = {
  storeSlug: string
  isOwner: boolean
}

/** Shown when the affiliate views their public storefront — clarifies buyer vs business views. */
export function AffiliateStorePreviewBanner({ storeSlug, isOwner }: Props) {
  if (!isOwner) return null

  return (
    <div
      role="status"
      className="border-b border-violet-200/80 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-white dark:border-violet-800"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm">
        <p className="inline-flex items-center gap-2 font-medium">
          <Eye className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Aperçu boutique client — c&apos;est ce que vos acheteurs voient sur{" "}
          <span className="font-semibold">/shops/{storeSlug}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/affiliate"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur hover:bg-white/25"
          >
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
            Mon dashboard
          </Link>
          <Link
            href={AFFILIATE_CATALOG_PATH}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-900 hover:bg-violet-50"
          >
            Catalogue affilié
          </Link>
        </div>
      </div>
    </div>
  )
}
