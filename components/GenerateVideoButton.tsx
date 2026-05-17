"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  productName: string
  style: string
  className?: string
}

export function GenerateVideoButton({ productName, style, className }: Props) {
  const [loading, setLoading] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  async function handleGenerate() {
    if (!productName.trim() || !style.trim()) {
      toast.error("Product name and style are required.")
      return
    }

    setLoading(true)
    setVideoUrl(null)

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: productName.trim(), style: style.trim() }),
      })

      const data = (await res.json()) as {
        error?: string
        videoUrl?: string
        jobId?: string
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Video generation failed")
      }

      if (!data.videoUrl) {
        throw new Error("No video URL returned")
      }

      setVideoUrl(data.videoUrl)
      toast.success("Video ready")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Video generation failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <Button
        type="button"
        variant="bentoAccent"
        disabled={loading}
        onClick={() => void handleGenerate()}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles />
            Generate video
          </>
        )}
      </Button>

      {videoUrl ? (
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          <video
            src={videoUrl}
            controls
            playsInline
            className="aspect-[9/16] max-h-[480px] w-full bg-black object-contain"
          />
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="underline">
              Open video
            </a>
          </p>
        </div>
      ) : null}
    </div>
  )
}
