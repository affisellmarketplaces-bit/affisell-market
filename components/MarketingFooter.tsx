import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"

export async function MarketingFooter() {
  const t = await getTranslations("footer")

  return (
    <footer className="border-t border-gray-100 pt-12 dark:border-gray-800">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-bold text-zinc-900 dark:text-zinc-50">Affisell</p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              <Link href="/contact" className="hover:text-[#6366F1]">
                {t("about")}
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-[#6366F1]">
                {t("contact")}
              </Link>
            </li>
            <li>
              <span>{t("terms")}</span>
            </li>
            <li>
              <span>{t("privacy")}</span>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t("sellTitle")}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/creators" className="hover:text-[#6366F1]">
                {t("becomeCreator")}
              </Link>
            </li>
            <li>
              <Link href="/partners" className="hover:text-[#6366F1]">
                {t("becomePartner")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t("helpTitle")}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/faq" className="hover:text-[#6366F1]">
                {t("faq")}
              </Link>
            </li>
            <li>
              <span>{t("shipping")}</span>
            </li>
            <li>
              <Link href="/faq#cashback" className="hover:text-[#6366F1]">
                {t("returns")}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="mt-10 text-center text-xs text-zinc-500">© {new Date().getFullYear()} Affisell</p>
    </footer>
  )
}
