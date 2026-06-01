"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

import { forgotPasswordHref } from "@/lib/auth-forgot-password-href"
import type { LoginPortal } from "@/lib/auth-login-portal"
import { cn } from "@/lib/utils"

type Props = {
  portal?: LoginPortal | null
  className?: string
  variant?: "inline" | "pill"
}

export function PasswordResetForgotLink({ portal = null, className, variant = "inline" }: Props) {
  const t = useTranslations("auth.passwordReset")

  if (variant === "pill") {
    return (
      <Link
        href={forgotPasswordHref(portal)}
        className={cn(
          "inline-flex items-center justify-center rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:border-violet-300/60 hover:bg-violet-500/20 hover:text-white",
          className
        )}
      >
        {t("forgotLink")}
      </Link>
    )
  }

  return (
    <Link
      href={forgotPasswordHref(portal)}
      className={cn(
        "text-sm font-medium text-violet-400 underline-offset-4 transition hover:text-violet-300 hover:underline",
        className
      )}
    >
      {t("forgotLink")}
    </Link>
  )
}
