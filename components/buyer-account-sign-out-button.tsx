"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function BuyerAccountSignOutButton() {
  return (
    <button
      type="button"
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "gap-1.5 border-zinc-200 bg-white/90 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-100 dark:hover:bg-zinc-800"
      )}
      onClick={() => void signOut({ callbackUrl: "/shops/browse" })}
    >
      <LogOut className="size-4 shrink-0" aria-hidden />
      Déconnexion
    </button>
  )
}
