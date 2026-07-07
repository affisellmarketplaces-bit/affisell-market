import { getTranslations } from "next-intl/server"

import { AppLink } from "@/components/i18n/app-link"

export async function MarketingFooter() {
  const t = await getTranslations("footer")

  return (
    <footer className="affisell-site-footer mt-auto shrink-0 border-t border-gray-100 dark:border-gray-800">
      <div className="affisell-site-footer__pad grid gap-8 px-4 pt-12 sm:px-6 lg:px-8 lg:pb-12">
        <div>
          <p className="font-bold text-zinc-900 dark:text-zinc-50">Affisell</p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              <AppLink href="/contact" className="hover:text-[#6366F1]">
                {t("about")}
              </AppLink>
            </li>
            <li>
              <AppLink href="/contact" className="hover:text-[#6366F1]">
                {t("contact")}
              </AppLink>
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
              <AppLink href="/sell" className="hover:text-[#6366F1]">
                {t("sellOnAffisell")}
              </AppLink>
            </li>
            <li>
              <AppLink href="/signup/affiliate" className="hover:text-[#6366F1]">
                {t("becomeReseller")}
              </AppLink>
            </li>
            <li>
              <AppLink href="/partners" className="hover:text-[#6366F1]">
                {t("becomePartner")}
              </AppLink>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t("helpTitle")}</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <AppLink href="/faq" className="hover:text-[#6366F1]">
                {t("faq")}
              </AppLink>
            </li>
            <li>
              <AppLink href="/shipping" className="hover:text-[#6366F1]">
                {t("shipping")}
              </AppLink>
            </li>
            <li>
              <AppLink href="/protected-checkout" className="hover:text-[#6366F1]">
                {t("returns")}
              </AppLink>
            </li>
            <li>
              <AppLink href="/support" className="hover:text-[#6366F1]">
                Support IA
              </AppLink>
            </li>
          </ul>
        </div>
      </div>
      <p className="mt-10 text-center text-xs text-zinc-500">© {new Date().getFullYear()} Affisell</p>
    </footer>
  )
}
