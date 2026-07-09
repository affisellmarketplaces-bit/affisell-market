"use client"

import { Check, Copy, MessageCircle, Share2, Sparkles, X } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import {
  isLikelyMobileUserAgent,
  markShareSentFlag,
  orderSocialShareChannels,
  readShareSentFlag,
  recommendShareChannel,
  type ShareChannelId,
} from "@/lib/storefront-share-channel-recommendation"
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
  amplifyMode?: boolean
  /** Onboarding post-publish — show traffic loop + channel recommendation. */
  postShareLoop?: boolean
  initialTotalClicks?: number
  initialTotalConversions?: number
  className?: string
}

const TRAFFIC_POLL_MS = 15_000

export function StorefrontShareGrowPanel({
  slug,
  storeName,
  shopUrl,
  embedEnabled = false,
  onEnableEmbed,
  amplifyMode = false,
  postShareLoop = false,
  initialTotalClicks = 0,
  initialTotalConversions = 0,
  className,
}: Props) {
  const t = useTranslations("storefront.brandStudio.shareGrow")
  const locale = useLocale()
  const [copied, setCopied] = useState(false)
  const [copiedAmplifyId, setCopiedAmplifyId] = useState<"creatorBio" | "blogIntro" | null>(null)
  const [sharing, setSharing] = useState(false)
  const [shareSent, setShareSent] = useState(false)
  const [totalClicks, setTotalClicks] = useState(initialTotalClicks)
  const [totalConversions, setTotalConversions] = useState(initialTotalConversions)
  const hadTrafficRef = useRef(initialTotalClicks > 0)

  const nativeShareAvailable = canUseNativeWebShare()
  const isMobile =
    typeof navigator !== "undefined" && isLikelyMobileUserAgent(navigator.userAgent)

  const recommendedChannel = useMemo(
    () =>
      recommendShareChannel({
        embedEnabled,
        nativeShareAvailable,
        isMobile,
        locale,
      }),
    [embedEnabled, nativeShareAvailable, isMobile, locale]
  )

  const socialChannelOrder = useMemo(
    () => orderSocialShareChannels(recommendedChannel),
    [recommendedChannel]
  )

  useEffect(() => {
    setTotalClicks(initialTotalClicks)
    setTotalConversions(initialTotalConversions)
    if (initialTotalClicks > 0) hadTrafficRef.current = true
  }, [initialTotalClicks, initialTotalConversions])

  useEffect(() => {
    if (!slug) return
    setShareSent(readShareSentFlag(slug))
  }, [slug])

  useEffect(() => {
    capturePosthogClient("brand_share_recommended_channel_shown", {
      storeSlug: slug,
      channel: recommendedChannel,
      postShareLoop,
    })
  }, [slug, recommendedChannel, postShareLoop])

  const markShared = useCallback(
    (channel: ShareChannelId) => {
      markShareSentFlag(slug)
      setShareSent(true)
      capturePosthogClient("brand_share_channel_opened", { storeSlug: slug, channel })
      console.log("[share-grow]", { storeSlug: slug, channel, result: "opened" })
    },
    [slug]
  )

  const refreshTraffic = useCallback(async () => {
    if (!postShareLoop) return
    try {
      const res = await fetch("/api/store/share-traffic", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) return
      const json = (await res.json()) as {
        totalClicks?: number
        totalConversions?: number
      }
      const clicks = json.totalClicks ?? 0
      const conversions = json.totalConversions ?? 0
      setTotalClicks(clicks)
      setTotalConversions(conversions)
      if (clicks > 0 && !hadTrafficRef.current) {
        hadTrafficRef.current = true
        capturePosthogClient("brand_share_traffic_first_click", {
          storeSlug: slug,
          totalClicks: clicks,
        })
        console.log("[share-grow]", { storeSlug: slug, totalClicks: clicks, result: "first_traffic" })
      }
    } catch (err) {
      console.log("[share-grow]", {
        storeSlug: slug,
        result: "traffic_poll_error",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [postShareLoop, slug])

  useEffect(() => {
    if (!postShareLoop) return
    void refreshTraffic()
    const interval = window.setInterval(() => void refreshTraffic(), TRAFFIC_POLL_MS)
    return () => window.clearInterval(interval)
  }, [postShareLoop, refreshTraffic])

  const shareMessage = t("shareMessage", { name: storeName.trim() || slug })
  const amplifySnippets = useMemo(
    () => ({
      creatorBio: t("amplify.creatorBioSnippet", {
        name: storeName.trim() || slug,
        url: shopUrl ?? "",
      }),
      blogIntro: t("amplify.blogIntroSnippet", {
        name: storeName.trim() || slug,
        url: shopUrl ?? "",
      }),
    }),
    [shopUrl, slug, storeName, t]
  )
  const showAmplifyKit = Boolean(shopUrl && embedEnabled && totalConversions > 0)

  const copyUrl = useCallback(async () => {
    if (!shopUrl) return
    try {
      await navigator.clipboard.writeText(shopUrl)
      setCopied(true)
      markShared("clipboard")
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
  }, [shopUrl, slug, markShared])

  const copyAmplifySnippet = useCallback(
    async (snippetId: "creatorBio" | "blogIntro") => {
      if (!shopUrl) return
      const snippet = amplifySnippets[snippetId]
      try {
        await navigator.clipboard.writeText(snippet)
        setCopiedAmplifyId(snippetId)
        capturePosthogClient("brand_share_amplify_copied", { storeSlug: slug, snippetId })
        console.log("[share-grow]", { storeSlug: slug, snippetId, result: "amplify_copied" })
        window.setTimeout(() => setCopiedAmplifyId((current) => (current === snippetId ? null : current)), 2000)
      } catch (err) {
        console.log("[share-grow]", {
          storeSlug: slug,
          snippetId,
          result: "amplify_copy_error",
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [amplifySnippets, shopUrl, slug]
  )

  const nativeShare = useCallback(async () => {
    if (!shopUrl || !nativeShareAvailable) return
    setSharing(true)
    try {
      await navigator.share({
        title: storeName.trim() || slug,
        text: shareMessage,
        url: shopUrl,
      })
      markShared("native")
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
  }, [shopUrl, slug, storeName, shareMessage, nativeShareAvailable, markShared])

  if (!shopUrl) return null

  const whatsAppUrl = buildStorefrontWhatsAppShareUrl(shopUrl, shareMessage)
  const twitterUrl = buildStorefrontTwitterShareUrl(shopUrl, shareMessage)

  function RecommendedBadge() {
    return (
      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
        {t("recommended")}
      </span>
    )
  }

  function SocialButton({
    channel,
    href,
    recommended,
  }: {
    channel: "whatsapp" | "twitter"
    href: string
    recommended: boolean
  }) {
    const isWhatsApp = channel === "whatsapp"
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => markShared(channel)}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition",
          isWhatsApp
            ? "border-emerald-200/80 bg-white text-emerald-900 hover:border-emerald-400 dark:border-emerald-900/50 dark:bg-zinc-950 dark:text-emerald-100"
            : "border-zinc-200/80 bg-white text-zinc-800 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100",
          recommended && "ring-2 ring-emerald-400/80 ring-offset-1 dark:ring-emerald-500/70"
        )}
      >
        {recommended ? (
          <span className="absolute -top-2 right-2">
            <RecommendedBadge />
          </span>
        ) : null}
        {isWhatsApp ? (
          <MessageCircle className="size-4" aria-hidden />
        ) : (
          <X className="size-4" aria-hidden />
        )}
        {isWhatsApp ? "WhatsApp" : "X"}
      </a>
    )
  }

  const trafficStatus =
    totalConversions > 0
      ? t("firstSale", { count: totalConversions })
      : totalClicks > 0
        ? t("firstTraffic", { count: totalClicks })
        : shareSent
          ? t("awaitingFirstClick")
          : postShareLoop
            ? t("postSharePrompt")
            : null

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

        {trafficStatus ? (
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium",
              totalClicks > 0 || totalConversions > 0
                ? "border-emerald-300/80 bg-emerald-100/80 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "border-amber-200/80 bg-amber-50/80 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
            )}
          >
            {totalClicks > 0 || totalConversions > 0 ? (
              <Sparkles className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            ) : null}
            <p>{trafficStatus}</p>
          </div>
        ) : null}

        <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-3 dark:border-emerald-900/40 dark:bg-zinc-950/60">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {t("primaryLink")}
          </p>
          <p className="mt-1 break-all font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {shopUrl}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="bentoSolid"
              className={cn(
                recommendedChannel === "clipboard" &&
                  "ring-2 ring-emerald-400/80 ring-offset-1 dark:ring-emerald-500/70"
              )}
              onClick={() => void copyUrl()}
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? t("copied") : t("copyLink")}
              {recommendedChannel === "clipboard" ? (
                <span className="ml-1">
                  <RecommendedBadge />
                </span>
              ) : null}
            </Button>
            {nativeShareAvailable ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={sharing}
                className={cn(
                  recommendedChannel === "native" &&
                    "ring-2 ring-emerald-400/80 ring-offset-1 dark:ring-emerald-500/70"
                )}
                onClick={() => void nativeShare()}
              >
                <Share2 className="size-4" aria-hidden />
                {t("nativeShare")}
                {recommendedChannel === "native" ? (
                  <span className="ml-1">
                    <RecommendedBadge />
                  </span>
                ) : null}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {socialChannelOrder.map((channel) => (
            <SocialButton
              key={channel}
              channel={channel}
              href={channel === "whatsapp" ? whatsAppUrl : twitterUrl}
              recommended={recommendedChannel === channel}
            />
          ))}
        </div>

        {showAmplifyKit ? (
          <div
            className={cn(
              "rounded-xl border p-3",
              amplifyMode
                ? "border-violet-300/80 bg-violet-50/70 ring-2 ring-violet-300/60 ring-offset-1 dark:border-violet-800 dark:bg-violet-950/25 dark:ring-violet-700/60"
                : "border-violet-200/70 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/20"
            )}
          >
            <p className="text-xs font-semibold text-violet-950 dark:text-violet-100">{t("amplify.title")}</p>
            <p className="mt-1 text-xs leading-relaxed text-violet-900/80 dark:text-violet-100/80">
              {t("amplify.subtitle")}
            </p>
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-violet-200/80 bg-white/80 p-3 dark:border-violet-900/40 dark:bg-zinc-950/60">
                <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">{t("amplify.creatorBio")}</p>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {amplifySnippets.creatorBio}
                </pre>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => void copyAmplifySnippet("creatorBio")}
                >
                  {copiedAmplifyId === "creatorBio" ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    <Copy className="size-3.5" aria-hidden />
                  )}
                  {copiedAmplifyId === "creatorBio" ? t("copied") : t("amplify.copy")}
                </Button>
              </div>

              <div className="rounded-lg border border-violet-200/80 bg-white/80 p-3 dark:border-violet-900/40 dark:bg-zinc-950/60">
                <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">{t("amplify.blogIntro")}</p>
                <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {amplifySnippets.blogIntro}
                </pre>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => void copyAmplifySnippet("blogIntro")}
                >
                  {copiedAmplifyId === "blogIntro" ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : (
                    <Copy className="size-3.5" aria-hidden />
                  )}
                  {copiedAmplifyId === "blogIntro" ? t("copied") : t("amplify.copy")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {!embedEnabled && onEnableEmbed ? (
          <button
            type="button"
            onClick={() => {
              onEnableEmbed()
              markShared("embed")
              capturePosthogClient("brand_embed_enabled_from_share", { storeSlug: slug })
              console.log("[share-grow]", { storeSlug: slug, result: "embed_enabled" })
            }}
            className={cn(
              "relative w-full rounded-xl border border-dashed px-3 py-2.5 text-left text-xs font-medium transition",
              recommendedChannel === "embed"
                ? "border-emerald-400/80 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-400/60 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100"
                : "border-violet-300/70 bg-violet-50/50 text-violet-900 hover:border-violet-400 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-100"
            )}
          >
            {recommendedChannel === "embed" ? (
              <span className="mb-1 inline-flex">
                <RecommendedBadge />
              </span>
            ) : null}
            <span className="block">{t("enableEmbedHint")}</span>
          </button>
        ) : null}
      </div>
    </BentoCard>
  )
}
