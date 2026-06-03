"use client"

import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { LogOut, Settings } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

export function MerchantAvatarMenu({ className }: Props) {
  const t = useTranslations("nav.accountMenu")
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  const name = session?.user?.name?.trim() || session?.user?.email?.split("@")[0] || "?"
  const initial = name.slice(0, 1).toUpperCase()
  const image = session?.user?.image

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setCoords({ top: r.bottom + 6, left: Math.max(8, r.right - 200) })
  }, [open])

  return (
    <div className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        aria-label={t("aria")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-violet-200/80 bg-violet-100 text-sm font-semibold text-violet-900 ring-offset-2 transition hover:ring-2 hover:ring-violet-400/50 dark:border-violet-800/60 dark:bg-violet-950 dark:text-violet-100"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="size-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[200] cursor-default bg-transparent"
                aria-label={t("close")}
                onClick={() => setOpen(false)}
              />
              <div
                role="menu"
                className="fixed z-[201] w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                style={{ top: coords.top, left: coords.left }}
              >
                <p className="truncate px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {session?.user?.email}
                </p>
                <Link
                  href="/dashboard/settings/account"
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => setOpen(false)}
                >
                  <Settings className="size-4 shrink-0 opacity-70" aria-hidden />
                  {t("settings")}
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => void signOut({ callbackUrl: "/" })}
                >
                  <LogOut className="size-4 shrink-0 opacity-70" aria-hidden />
                  {t("signOut")}
                </button>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  )
}
