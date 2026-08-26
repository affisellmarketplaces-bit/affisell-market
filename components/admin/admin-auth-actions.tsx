"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { LogIn, LogOut } from "lucide-react"

import type { AdminNavSession } from "@/lib/admin/admin-nav-session"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  session: AdminNavSession | null
}

/** Admin auth chrome — session from server layout (React 19 safe, no useSession). */
export function AdminAuthActions({ session }: Props) {
  const pathname = usePathname()
  const t = useTranslations("auth.adminLogin")
  const connected = Boolean(session?.user?.id)
  const displayName =
    session?.user?.name?.trim() || session?.user?.email?.trim() || t("fallbackName")
  const userEmail = session?.user?.email ?? null

  const callbackUrl = encodeURIComponent(pathname || "/admin/auto-fulfill")
  const onAdminLoginPage = pathname?.startsWith("/login/admin")

  if (connected) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span
          className="hidden max-w-[140px] truncate text-xs text-zinc-500 sm:inline"
          title={userEmail ?? undefined}
        >
          {displayName}
        </span>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-1.5 border-violet-200 text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-100 dark:hover:bg-violet-950/50"
          )}
          onClick={() => {
            console.log("[admin-auth] sign_out", { email: userEmail })
            void signOut({ callbackUrl: "/login/admin" })
          }}
        >
          <LogOut className="size-3.5 shrink-0" aria-hidden />
          {t("signOut")}
        </button>
      </div>
    )
  }

  if (onAdminLoginPage) return null

  return (
    <Link
      href={`/login/admin?callbackUrl=${callbackUrl}`}
      className={cn(buttonVariants({ variant: "bentoAccent", size: "sm" }), "gap-1.5 shrink-0")}
    >
      <LogIn className="size-3.5 shrink-0" aria-hidden />
      {t("signIn")}
    </Link>
  )
}
