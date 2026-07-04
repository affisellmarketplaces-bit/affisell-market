"use client"

import { Check, Copy, MessageCircle, Share2, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import {
  buildStorefrontTwitterShareUrl,
  buildStorefrontWhatsAppShareUrl,
  canUseNativeWebShare,
} from "@/lib/storefront-share-grow-shared"
import { cn } from "@/lib/utils"

type Props = {
  slug: string
  storeName: string
  shopUrl: string | null
  embedEnabled?: boolean
  onEnableEmbed?: () => void
  className?: string
}

export function StorefrontShareGrowPanel({
  slug,
  storeName,
  shopUrl,
  embedEnabled = false,
  onEnableEmbed,
  className,
}: Props) {
  const t = useTranslations("storefront.brandStudio.shareGrow")
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const shareMessage = t("shareMessage", { name: storeName.trim() || slug })

  const copyUrl = useCallback(async () => {
    if (!shopUrl) return
    try {
      await navigator.clipboard.writeText(shopUrl)
      setCopied(true)
      capturePosthogClient("brand_share_link_copied", { storeSlug: slug, channel: "clipboard" })
      console.log("[share-grow]", { storeSlug: slug, channel: "clipboard", result: "ok" })
      window.setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.log("[share-grow]", {
        storeSlug: slug,
        channel: "clipboard",
        result: "error",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [shopUrl, slug])

  const nativeShare = useCallback(async () => {
    if (!shopUrl || !canUseNativeWebShare()) return
    setSharing(true)
    try {
      await navigator.share({
        title: storeName.trim() || slug,
        text: shareMessage,
        url: shopUrl,
      })
      capturePosthogClient("brand_share_native", { storeSlug: slug })
      console.log("[share-grow]", { storeSlug: slug, channel: "native", result: "ok" })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      console.log("[share-grow]", {
        storeSlug: slug,
        channel: "native",
        result: "error",
        error: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSharing(false)
    }
  }, [shopUrl, slug, storeName, shareMessage])

  if (!shopUrl) return null

  const whatsAppUrl = buildStorefrontWhatsAppShareUrl(shopUrl, shareMessage)
  const twitterUrl = buildStorefrontTwitterShareUrl(shopUrl, shareMessage)

  function trackChannel(channel: string) {
    capturePosthogClient("brand_share_channel_opened", { storeSlug: slug, channel })
    console.log("[share-grow]", { storeSlug: slug, channel, result: "opened" })
  }

  return (
    <BentoCard
      className={cn(
        "relative overflow-hidden border-emerald-300/60 bg-gradient-to-br from-emerald-50/90 via-white to-violet-50/60 dark:border-emerald-900/50 dark:from-emerald-950/25 dark:via-zinc-950 dark:to-violet-950/20",
        className
      )}
    >
      <div className="space-y-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950 dark:text-emerald-100">
            <Share2 className="size-4 text-emerald-600" aria-hidden />
            {t("title")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">
            {t("subtitle")}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-3 dark:border-emerald-900/40 dark:bg-zinc-950/60">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {t("primaryLink")}
          </p>
          <p className="mt-1 break-all font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {shopUrl}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="bentoSolid" onClick={() => void copyUrl()}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? t("copied") : t("copyLink")}
            </Button>
            {canUseNativeWebShare() ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={sharing}
                onClick={() => void nativeShare()}
              >
                <Share2 className="size-4" aria-hidden />
                {t("nativeShare")}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackChannel("whatsapp")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200/80 bg-white px-3 py-2.5 text-xs font-semibold text-emerald-900 transition hover:border-emerald-400 dark:border-emerald-900/50 dark:bg-zinc-950 dark:text-emerald-100"
          >
            <MessageCircle className="size-4" aria-hidden />
            WhatsApp
          </a>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackChannel("twitter")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200/80 bg-white px-3 py-2.5 text-xs font-semibold text-zinc-800 transition hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <X className="size-4" aria-hidden />
            X
          </a>
        </div>

        {!embedEnabled && onEnableEmbed ? (
          <button
            type="button"
            onClick={() => {
              onEnableEmbed()
              capturePosthogClient("brand_embed_enabled_from_share", { storeSlug: slug })
              console.log("[share-grow]", { storeSlug: slug, result: "embed_enabled" })
            }}
            className="w-full rounded-xl border border-dashed border-violet-300/70 bg-violet-50/50 px-3 py-2.5 text-left text-xs font-medium text-violet-900 transition hover:border-violet-400 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-100"
          >
            {t("enableEmbedHint")}
          </button>
        ) : null}
      </div>
    </BentoCard>
  )
}
