"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"

import { BuyerPremiumLogo } from "@/components/home/buyer-premium-logo"
import { FastLink } from "@/components/navigation/fast-link"
import { Link as LocaleLink } from "@/i18n/navigation"
import { BUYER_PREMIUM, buyerPremiumCtaClass } from "@/lib/buyer-premium-home-tokens"
import { loginCustomerPath, MARKETPLACE_BUYER_ORDERS_PATH } from "@/lib/login-redirect"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { href: "/shops", label: "Stores" },
  { href: "/#explorer", label: "Products" },
  { href: "/legal/transparence", label: "Protection" },
  { href: "/help/faq", label: "Help" },
] as const

type Props = {
  signInHref: string
}

export function BuyerPremiumPublicNav({ signInHref }: Props) {
  const { status } = useSession()
  const t = useTranslations("PublicNav")

  return (
    <nav
      aria-label="Main"
      className="mx-auto hidden w-full min-w-0 max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:flex"
      data-testid="buyer-premium-nav"
    >
      <div className="flex min-w-0 items-center gap-3">
        <LocaleLink href="/" className="shrink-0">
          <BuyerPremiumLogo />
        </LocaleLink>
      </div>

      <div
        className="flex items-center gap-6 text-sm font-medium dark:text-slate-200"
        style={{ color: BUYER_PREMIUM.text.nav }}
      >
        {NAV_LINKS.map((link) => (
          <FastLink
            key={link.href}
            href={link.href}
            localeAware={link.href !== "/#explorer"}
            className="transition hover:text-[#4338ca] dark:hover:text-indigo-400"
          >
            {link.label}
          </FastLink>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {status === "authenticated" ? (
          <FastLink
            href="/marketplace/account"
            className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {t("myAccount")}
          </FastLink>
        ) : (
          <>
            <FastLink
              href={signInHref}
              className="inline-flex h-9 items-center rounded-full border border-slate-900/15 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            >
              Sign in
            </FastLink>
            <Link
              href="/signup"
              className={cn(
                "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold",
                buyerPremiumCtaClass
              )}
            >
              Join Premium
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

export function resolveBuyerPremiumSignInHref(isBuyerContext: boolean): string {
  return isBuyerContext ? loginCustomerPath(MARKETPLACE_BUYER_ORDERS_PATH) : "/login"
}
