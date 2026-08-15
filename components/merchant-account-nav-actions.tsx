"use client"

import Link from "next/link"
import { LogOut, UserRound } from "lucide-react"
import { signOut } from "next-auth/react"
import { useTranslations } from "next-intl"

import { AccountDeletionFlow } from "@/components/account/account-deletion-flow"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** When false, only sign out (+ delete if enabled) on `/dashboard/settings/account`. */
  showAccountLink?: boolean
  /** Delete account is only shown in account settings, not in the header. */
  showDeleteAccount?: boolean
}

export function MerchantAccountNavActions({
  className,
  showAccountLink = true,
  showDeleteAccount = false,
}: Props) {
  const t = useTranslations("merchantAccount")

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {showAccountLink ? (
        <Link
          href="/dashboard/settings/account"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-1.5 border-zinc-200 bg-white/90 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-800"
          )}
        >
          <UserRound className="size-4 shrink-0" aria-hidden />
          {t("account")}
        </Link>
      ) : null}
      <button
        type="button"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5 border-zinc-200 bg-white/90 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-800"
        )}
        onClick={() => void signOut({ callbackUrl: "/" })}
      >
        <LogOut className="size-4 shrink-0" aria-hidden />
        {t("signOut")}
      </button>
      {showDeleteAccount ? (
        <AccountDeletionFlow variant="merchant" triggerLabel={t("deleteAccount")} />
      ) : null}
    </div>
  )
}
