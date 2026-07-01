"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  isPwaInstallEligiblePath,
  PWA_INSTALL_DISMISS_KEY,
} from "@/lib/pwa-install-shared"
import { cn } from "@/lib/utils"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  )
}

export function PwaInstallBanner() {
  const t = useTranslations("pwa.install")
  const pathname = usePathname()
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isStandaloneDisplay()) return
    if (localStorage.getItem(PWA_INSTALL_DISMISS_KEY) === "1") return
    if (!isPwaInstallEligiblePath(pathname)) return

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall)
  }, [pathname])

  const dismiss = useCallback(() => {
    localStorage.setItem(PWA_INSTALL_DISMISS_KEY, "1")
    setVisible(false)
  }, [])

  const install = useCallback(async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    setVisible(false)
    if (choice.outcome === "accepted") {
      localStorage.setItem(PWA_INSTALL_DISMISS_KEY, "1")
    }
  }, [promptEvent])

  if (!visible || !promptEvent) return null

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[190] px-3 md:hidden",
        "pointer-events-none"
      )}
      role="region"
      aria-label={t("title")}
    >
      <div className="pointer-events-auto mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-violet-200/80 bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-violet-900/50 dark:bg-zinc-950/95">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
          <Download className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t("title")}</p>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{t("body")}</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" className="h-8 rounded-lg" onClick={() => void install()}>
              {t("cta")}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 rounded-lg" onClick={dismiss}>
              {t("later")}
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label={t("dismiss")}
          onClick={dismiss}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
