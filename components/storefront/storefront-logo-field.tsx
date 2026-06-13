"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { ImagePlus, Link2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type Props = {
  logoUrl: string
  logoPreview: string | null
  onLogoUrlChange: (url: string) => void
  onLogoFile: (file: File | null) => void
}

export function StorefrontLogoField({ logoUrl, logoPreview, onLogoUrlChange, onLogoFile }: Props) {
  const t = useTranslations("storefront.brandStudio.logo")
  const fileRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const preview = localPreview ?? logoPreview

  function onPickFile(file: File | null) {
    onLogoFile(file)
    if (localPreview) URL.revokeObjectURL(localPreview)
    if (file) {
      setLocalPreview(URL.createObjectURL(file))
    } else {
      setLocalPreview(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t("title")}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className={cn(
            "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-white dark:border-zinc-700 dark:bg-zinc-950",
            preview && "border-solid"
          )}
        >
          {preview ? (
            <Image src={preview} alt="" width={80} height={80} className="h-full w-full object-cover" unoptimized />
          ) : (
            <ImagePlus className="size-7 text-gray-400" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <ImagePlus className="size-4" aria-hidden />
            {t("upload")}
          </button>
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <Input
              bento
              type="url"
              value={logoUrl}
              onChange={(e) => onLogoUrlChange(e.target.value)}
              placeholder="https://…"
              className="pl-9"
            />
          </div>
          <p className="text-[11px] text-gray-500 dark:text-zinc-400">{t("hint")}</p>
        </div>
      </div>
    </div>
  )
}
