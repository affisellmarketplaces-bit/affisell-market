import { Truck, Zap, RotateCcw, ShieldCheck } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { FastLink } from "@/components/navigation/fast-link"
import { marketplaceCatalogHref } from "@/lib/marketplace-catalog-url"

const ITEMS = [
  {
    key: "freeShipping" as const,
    Icon: Truck,
    href: marketplaceCatalogHref("/", new URLSearchParams({ freeShipping: "1" })),
  },
  { key: "verifiedStores" as const, Icon: ShieldCheck, href: "/shops" },
  { key: "easyReturns" as const, Icon: RotateCcw, href: "/legal/protected-checkout" },
  { key: "flashDeals" as const, Icon: Zap, href: "/battles" },
]

/**
 * Value-proposition strip at the top of the marketplace card — same spot and spirit as AliExpress's
 * "Free shipping / Fast delivery / Free returns / New lower prices" bar, but every item here links to
 * a real, live Affisell feature (the free-shipping filter, verified shops, the actual legal returns
 * page, real flash deals) instead of being decorative text.
 */
export async function HomeValuePropsBar() {
  const t = await getTranslations("home.valueProps")

  return (
    <nav
      aria-label={t("aria")}
      className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-t-[1.75rem] border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-6"
    >
      {ITEMS.map(({ key, Icon, href }) => (
        <FastLink
          key={key}
          href={href}
          className="flex min-h-9 items-center gap-2 rounded-lg text-sm font-semibold text-[#7c2d12] transition hover:text-[#5c1f0c] dark:text-amber-200 dark:hover:text-amber-100"
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{t(key)}</span>
        </FastLink>
      ))}
    </nav>
  )
}
