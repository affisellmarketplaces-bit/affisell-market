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
      className="mx-auto hidden w-[calc(100%-32px)] max-w-7xl items-center justify-between gap-4 rounded- bg-[#C4B5FD] px-4 py-2.5 lg:flex"
      data-testid="buyer-premium-nav"
    >
      <div className="flex min-w-0 items-center gap-3 pl-1">
        <LocaleLink href="/" className="shrink-0">
          <BuyerPremiumLogo />
        </LocaleLink>
      </div>

      {/* BANDE BLANCHE GROUPÉE - même arrondi que le hero */}
      <div className="flex items-center rounded-full bg-white px-1.5 py-1.5 shadow-sm">
        {NAV_LINKS.map((link) => (
          <FastLink
            key={link.href}
            href={link.href}
            localeAware={link.href!== "/#explorer"}
            className="rounded-full px-5 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
          >
            {link.label}
          </FastLink>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {status === "authenticated"? (
          <FastLink
            href="/marketplace/account"
            className="inline-flex h-9 items-center rounded-full bg-white px-5 text-sm font-bold text-zinc-900 shadow-sm"
          >
            {t("myAccount")}
          </FastLink>
        ) : (
          <>
            <FastLink
              href={signInHref}
              className="inline-flex h-9 items-center rounded-full bg-white px-5 text-sm font-bold text-zinc-900 shadow-sm"
            >
              Sign in
            </FastLink>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center rounded-full bg-[#6354FF] px-5 text-sm font-semibold text-white shadow-sm"
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
  return isBuyerContext? loginCustomerPath(MARKETPLACE_BUYER_ORDERS_PATH) : "/login"
}