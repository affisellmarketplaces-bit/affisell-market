import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/about", key: "about" as const },
  { href: "/blog", key: "blog" as const },
  { href: "/careers", key: "careers" as const },
  { href: "/press", key: "press" as const },
]

export async function CompanyNav({ active }: { active: "about" | "blog" | "careers" | "press" }) {
  const t = await getTranslations("companyPages.nav")

  return (
    <nav aria-label={t("aria")} className="flex flex-wrap gap-2">
      {LINKS.map(({ href, key }) => (
        <Link
          key={href}
          href={href}
          aria-current={active === key ? "page" : undefined}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            active === key
              ? "bg-violet-600 text-white shadow-sm shadow-violet-600/25"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          )}
        >
          {t(key)}
        </Link>
      ))}
    </nav>
  )
}
