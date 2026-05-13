"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { LogOut, Trash2, UserRound } from "lucide-react"
import { useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  /** When false, only sign out + delete (e.g. on `/dashboard/settings/account`). */
  showAccountLink?: boolean
}

export function MerchantAccountNavActions({ className, showAccountLink = true }: Props) {
  const [busy, setBusy] = useState<"delete" | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function deleteAccount() {
    const ok = window.confirm(
      "Delete your account permanently? This cannot be undone. If you have past marketplace orders as merchant, deletion may be blocked."
    )
    if (!ok) return
    setErr(null)
    setBusy("delete")
    try {
      const res = await fetch("/api/user/account", { method: "DELETE" })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setErr(data.error ?? `Error (${res.status})`)
        return
      }
      await signOut({ callbackUrl: "/" })
    } finally {
      setBusy(null)
    }
  }

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
          Account
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
        Sign out
      </button>
      <button
        type="button"
        disabled={busy === "delete"}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5 border-red-200 bg-white/90 text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/60 dark:bg-zinc-900/90 dark:text-red-400 dark:hover:bg-red-950/40"
        )}
        onClick={() => void deleteAccount()}
      >
        <Trash2 className="size-4 shrink-0" aria-hidden />
        {busy === "delete" ? "Deleting…" : "Delete account"}
      </button>
      {err ? <p className="w-full text-xs text-red-600 dark:text-red-400">{err}</p> : null}
    </div>
  )
}
