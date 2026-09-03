"use client"

import Link from "next/link"
import { signOut, useSession } from "next-auth/react"
import { ChevronDown, ImagePlus, LogOut, Settings, Sparkles, UserRound } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"

import { resolveStoreAvatarUrl } from "@/lib/boutique/boutique-merchant-header-shared"
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
  const { status } = useSession()
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  const storeAvatarUrl = resolveStoreAvatarUrl({ logoUrl, aiAvatarUrl })
  const hasCustomMark = Boolean(storeAvatarUrl)
  const isSignedIn = status === "authenticated"

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setCoords({ top: r.bottom + 8, left: Math.max(8, r.right - 224) })
  }, [open])

  return (
    <div className={cn("relative flex items-center gap-0.5", className)}>
      <button
        ref={btnRef}
        type="button"
        aria-label={t("aria")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-0.5 rounded-full py-0.5 pl-0.5 pr-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:bg-[var(--boutique-merchant-header-hover-bg,rgba(255,255,255,0.1))]"
        style={{
          outlineColor: "var(--boutique-merchant-header-focus-ring, rgba(34,211,238,0.85))",
        }}
      >
        <span
          className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-[var(--boutique-merchant-header-hover-bg,rgba(255,255,255,0.06))]"
          style={{ borderColor: "var(--boutique-merchant-header-divider, rgba(255,255,255,0.3))" }}
        >
          {storeAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={storeAvatarUrl} alt="" className="size-full object-cover" loading="eager" />
          ) : (
            <UserRound
              className="size-5 stroke-[1.5]"
              style={{ color: "var(--boutique-merchant-header-icon, #ffffff)" }}
              aria-hidden
            />
          )}
          {isOwner && !hasCustomMark ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[9px] font-bold ring-2 transition-[background-color,color] duration-700 ease-in-out"
              style={{
                backgroundColor: "var(--boutique-merchant-header-cart-badge, #22d3ee)",
                color: "var(--boutique-merchant-header-cart-badge-text, #312e81)",
                borderColor: "var(--boutique-merchant-header-via, #312e81)",
              }}
              aria-hidden
            >
              +
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 transition", open && "rotate-180")}
          style={{ color: "var(--boutique-merchant-header-icon, #ffffff)" }}
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
                  {storeName.trim() || t("storeFallback")}
                </p>
                {isOwner ? (
                  <>
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
                    <Link
                      href={settingsHref}
                      role="menuitem"
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-white hover:bg-white/10"
                      onClick={() => setOpen(false)}
                    >
                      <Settings className="size-4 shrink-0 opacity-80" aria-hidden />
                      {t("settings")}
                    </Link>
                    {isSignedIn ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white hover:bg-white/10"
                        onClick={() => void signOut({ callbackUrl: "/" })}
                      >
                        <LogOut className="size-4 shrink-0 opacity-80" aria-hidden />
                        {t("signOut")}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="px-3 pb-2.5 text-xs leading-relaxed text-white/60">{t("visitorHint")}</p>
                )}
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  )
}
