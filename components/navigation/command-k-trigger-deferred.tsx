"use client"

import { Zap } from "lucide-react"
import { useTranslations } from "next-intl"

import { COMMAND_K_OPEN_EVENT } from "@/components/CommandK"
import { useIdleMount } from "@/hooks/use-idle-mount"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

/** Desktop ⌘K chip — mounts after idle so cmdk listeners stay off TBT window. */
export function CommandKTriggerDeferred({ className }: Props) {
  const t = useTranslations("PublicNav")
  const tCmd = useTranslations("CommandK")
  const ready = useIdleMount({ idleTimeoutMs: 2800, fallbackDelayMs: 800 })

  if (!ready) {
    return <span className={cn("hidden h-9 shrink-0 lg:inline-block", className)} aria-hidden />
  }

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(COMMAND_K_OPEN_EVENT))}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-zinc-200/90 bg-white/90 px-2.5 text-xs font-semibold text-zinc-600 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 dark:border-zinc-700/90 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:border-violet-500/50 dark:hover:bg-violet-950/50 dark:hover:text-violet-200",
        className
      )}
      aria-label={`${tCmd("triggerLabel")} (⌘K)`}
    >
      <Zap className="size-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
      <kbd className="hidden rounded border border-zinc-200/90 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] lg:inline dark:border-zinc-600 dark:bg-zinc-950">
        {t("cmdKBadge")}
      </kbd>
    </button>
  )
}
