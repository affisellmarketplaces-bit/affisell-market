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
  { href: "/shops", label: "Stores", emphasis: "secondary" as const },
  { href: "/#explorer", label: "Products", emphasis: "primary" as const },
  { href: "/legal/transparence", label: "Protection", emphasis: "primary" as const },
  { href: "/help/faq", label: "Help", emphasis: "secondary" as const },
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

      <div className="flex items-center gap-6 text-sm">
        {NAV_LINKS.map((link) => (
          <FastLink
            key={link.href}
            href={link.href}
            localeAware={link.href !== "/#explorer"}
            className={cn(
              "buyer-premium-nav-link transition",
              link.emphasis === "primary"
                ? "buyer-premium-nav-link--primary"
                : "buyer-premium-nav-link--secondary"
            )}
          >
            {link.label}
          </FastLink>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {status === "authenticated" ? (
          <FastLink
            href="/marketplace/account"
            className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition hover:bg-violet-50"
            style={{
              borderColor: "rgba(30, 27, 75, 0.18)",
              color: BUYER_PREMIUM.text.navPrimary,
              backgroundColor: "rgba(255, 255, 255, 0.92)",
            }}
          >
            {t("myAccount")}
          </FastLink>
        ) : (
          <>
            <FastLink
              href={signInHref}
              className="inline-flex h-9 items-center rounded-full border border-[#1E1B4B]/20 bg-white/90 px-4 text-sm font-semibold text-[#1E1B4B] transition hover:bg-white"
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
