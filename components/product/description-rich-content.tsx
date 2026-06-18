"use client"

import {
  descriptionHasImageMarkers,
  parseDescriptionRichContent,
  unreferencedIllustrationImages,
} from "@/lib/description-rich-content"
import { cn } from "@/lib/utils"

type Props = {
  description: string
  images: string[]
  className?: string
  textClassName?: string
}

export function DescriptionRichContent({ description, images, className, textClassName }: Props) {
  const parts = parseDescriptionRichContent(description, images)
  const hasMarkers = descriptionHasImageMarkers(description)
  const trailingImages = hasMarkers ? unreferencedIllustrationImages(description, images) : []

  return (
    <div className={cn("space-y-4", className)}>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          part.text.trim() ? (
            <p
              key={`text-${index}`}
              className={cn(
                "whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300",
                textClassName
              )}
            >
              {part.text}
            </p>
          ) : null
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
      {hasMarkers && trailingImages.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {trailingImages.map((src) => (
            <li
              key={src}
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
