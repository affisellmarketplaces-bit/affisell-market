"use client"

import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { ChevronDown, ImagePlus, LogOut, Settings, Sparkles } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"

import {
  merchantAvatarInitial,
  resolveMerchantAvatarUrl,
} from "@/lib/boutique/boutique-merchant-header-shared"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  logoUrl: string | null
  aiAvatarUrl: string | null
  brandStudioHref: string
  settingsHref: string
  isOwner: boolean
  className?: string
}

export function BoutiqueMerchantAvatarMenu({
  storeName,
  logoUrl,
  aiAvatarUrl,
  brandStudioHref,
  settingsHref,
  isOwner,
  className,
}: Props) {
  const t = useTranslations("boutique.merchantHeader.avatar")
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  const avatarUrl = resolveMerchantAvatarUrl({
    logoUrl,
    aiAvatarUrl,
    userImage: session?.user?.image,
  })
  const initial = merchantAvatarInitial(storeName)
  const hasCustomMark = Boolean(logoUrl?.trim() || aiAvatarUrl?.trim())

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setCoords({ top: r.bottom + 8, left: Math.max(8, r.right - 224) })
  }, [open])

  return (
    <div className={cn("relative flex items-center gap-1", className)}>
      <button
        ref={btnRef}
        type="button"
        aria-label={t("aria")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-1 rounded-full p-0.5 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300/80"
      >
        <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/10 shadow-[0_0_20px_rgba(34,211,238,0.25)] ring-1 ring-white/10 transition group-hover:border-cyan-300/50 group-hover:shadow-[0_0_24px_rgba(34,211,238,0.45)]">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-full object-cover" loading="eager" />
          ) : (
            <span className="text-sm font-bold text-white">{initial}</span>
          )}
          {isOwner && !hasCustomMark ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-cyan-400 text-[9px] font-bold text-indigo-950 ring-2 ring-indigo-900"
              aria-hidden
            >
              +
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-white/80 transition",
            open && "rotate-180 text-cyan-200"
          )}
          aria-hidden
        />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[240] cursor-default bg-transparent"
                aria-label={t("close")}
                onClick={() => setOpen(false)}
              />
              <div
                role="menu"
                className="fixed z-[241] w-56 overflow-hidden rounded-2xl border border-white/10 bg-indigo-950/95 py-1 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                style={{ top: coords.top, left: coords.left }}
              >
                <p className="truncate px-3 py-2 text-xs font-medium text-cyan-100/70">
                  {storeName.trim() || session?.user?.email}
                </p>
                {isOwner ? (
                  <Link
                    href={brandStudioHref}
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-white hover:bg-white/10"
                    onClick={() => setOpen(false)}
                  >
                    {hasCustomMark ? (
                      <Sparkles className="size-4 shrink-0 text-cyan-300" aria-hidden />
                    ) : (
                      <ImagePlus className="size-4 shrink-0 text-cyan-300" aria-hidden />
                    )}
                    {hasCustomMark ? t("editLogo") : t("addLogo")}
                  </Link>
                ) : null}
                <Link
                  href={settingsHref}
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-white hover:bg-white/10"
                  onClick={() => setOpen(false)}
                >
                  <Settings className="size-4 shrink-0 opacity-80" aria-hidden />
                  {t("settings")}
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
                  onClick={() => void signOut({ callbackUrl: "/" })}
                >
                  <LogOut className="size-4 shrink-0 opacity-80" aria-hidden />
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
