"use client"

import {
  descriptionHasImageMarkers,
  parseDescriptionRichContent,
  stripDescriptionImageMarkers,
  unreferencedIllustrationImages,
} from "@/lib/description-rich-content"
import { cn } from "@/lib/utils"

type Props = {
  description: string
  images: string[]
  className?: string
  textClassName?: string
}

/**
 * Renders long description + illustrative photos.
 * - Inline `[[img:N]]` → image at that index
 * - Never leaks raw markers into the UI
 * - When no markers, still shows all illustration images after the text
 */
export function DescriptionRichContent({ description, images, className, textClassName }: Props) {
  const usableImages = images.filter((u) => typeof u === "string" && u.trim().length > 0)
  const hasMarkers = descriptionHasImageMarkers(description)
  const parts = parseDescriptionRichContent(description, usableImages)
  const trailingImages = hasMarkers
    ? unreferencedIllustrationImages(description, usableImages)
    : usableImages

  return (
    <div className={cn("space-y-4", className)}>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          (() => {
            const safeText = stripDescriptionImageMarkers(part.text)
            if (!safeText) return null
            return (
              <p
                key={`text-${index}`}
                className={cn(
                  "whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300",
                  textClassName
                )}
              >
                {safeText}
              </p>
            )
          })()
        ) : part.src ? (
          <div
            key={`img-${part.index}-${index}`}
            className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={part.src}
              alt=""
              className="max-h-[min(520px,70vh)] w-full object-contain p-2"
              loading="lazy"
            />
          </div>
        ) : null
      )}
      {trailingImages.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {trailingImages.map((src, imageIndex) => (
            <li
              key={`trailing-${imageIndex}`}
              className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="max-h-80 w-full object-contain p-2" loading="lazy" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
