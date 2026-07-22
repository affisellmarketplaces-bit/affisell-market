"use client"

import { useCallback, useState } from "react"

import { cn } from "@/lib/utils"

type Props = {
  productId: string
  bubbleUrl: string
  className?: string
}

export function BubbleShareBar({ productId, bubbleUrl, className }: Props) {
  const [copied, setCopied] = useState(false)

  const copyBubble = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(bubbleUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [bubbleUrl])

  const base = `/dashboard/reseller/products/${encodeURIComponent(productId)}/social`

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2 py-1.5 text-[10px] font-semibold text-white backdrop-blur-md",
        className
      )}
    >
      <a href={`${base}?format=story_1080x1920`} className="rounded-full px-2 py-1 hover:bg-white/10">
        📸 Story
      </a>
      <a href={`${base}?format=tiktok_1080x1920`} className="rounded-full px-2 py-1 hover:bg-white/10">
        🎵 TikTok
      </a>
      <a href={`${base}?format=pinterest_1000x1500`} className="rounded-full px-2 py-1 hover:bg-white/10">
        📌 Pin
      </a>
      <button type="button" onClick={() => void copyBubble()} className="rounded-full px-2 py-1 hover:bg-white/10">
        {copied ? "✓ Copié" : "🔗 Lien bulle"}
      </button>
    </div>
  )
}
