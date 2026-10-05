"use client"

import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { useDonaLinkClick } from "@/components/dona/dona-navigation"
import { DONA_LOGIN_PATH, DONA_SIGNUP_PATH, type DonaRole } from "@/lib/dona/dona-links"
import type { DonaSignupIntent } from "@/lib/dona/dona-signup-intent"
import type { AppLocale } from "@/lib/i18n-locale"
import { tMessage } from "@/lib/i18n-pick-message"

const ROLES_FOR: Record<DonaSignupIntent, readonly DonaRole[]> = {
  supplier: ["supplier"],
  reseller: ["reseller"],
  any: ["reseller", "supplier", "buyer"],
}

/**
 * Real buttons under Dona's answer when the visitor asked to sign up. The LLM's own link is best-effort (it has
 * pointed suppliers at the login page, or written a path in a form that did not link); this card is always right and
 * always tappable.
 */
export function DonaSignupCta({ intent, locale }: { intent: DonaSignupIntent; locale: AppLocale }) {
  const onLinkClick = useDonaLinkClick()
  const roles = ROLES_FOR[intent]
  const t = (key: string) => tMessage(locale, `donaWidget.public.signupCta.${key}`)

  return (
    <div
      data-testid="dona-signup-cta"
      className="mr-auto w-full max-w-[85%] space-y-2.5 rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-600/25 to-indigo-600/10 p-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200/80">
        {intent === "any" ? t("pickRole") : t("title")}
      </p>
      {roles.map((role) => (
        <div key={role} className="space-y-1">
          <Link
            href={DONA_SIGNUP_PATH[role]}
            onClick={onLinkClick}
            data-testid={`dona-signup-cta-${role}`}
            className="flex min-h-11 items-center justify-between gap-2 rounded-xl bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(124,58,237,0.4)] transition hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200 active:scale-[0.99]"
          >
            <span>{t(role)}</span>
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
          <Link
            href={DONA_LOGIN_PATH[role]}
            onClick={onLinkClick}
            className="block px-1 py-1 text-xs text-violet-200/70 underline-offset-2 hover:text-violet-100 hover:underline"
          >
            {t("haveAccount")}
          </Link>
        </div>
      ))}
    </div>
  )
}
