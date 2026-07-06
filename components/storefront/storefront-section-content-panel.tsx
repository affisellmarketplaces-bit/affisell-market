"use client"

import { useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import {
  updateHomepageSectionContent,
  type HomepageSection,
  type HomepageSectionContent,
  type HomepageSectionType,
} from "@/lib/storefront-sections-shared"

type Props = {
  section: HomepageSection
  sections: HomepageSection[]
  onChange: (sections: HomepageSection[]) => void
}

type FieldKey = keyof HomepageSectionContent

const FIELDS_BY_TYPE: Record<HomepageSectionType, FieldKey[]> = {
  hero: [],
  "flash-sale": [],
  story: ["eyebrow", "body"],
  bestsellers: ["eyebrow", "title", "body", "productLimit"],
  products: [],
  "social-proof": ["quote", "author", "stat"],
  trust: ["title", "body"],
  newsletter: ["title", "body", "placeholder", "buttonLabel"],
  cta: ["eyebrow", "title", "body", "buttonLabel", "buttonHref"],
}

export function StorefrontSectionContentPanel({ section, sections, onChange }: Props) {
  const t = useTranslations("storefront.brandStudio.sections.content")
  const fields = FIELDS_BY_TYPE[section.type]

  if (fields.length === 0) return null

  function patch(field: FieldKey, raw: string) {
    if (field === "productLimit") {
      const n = Number.parseInt(raw, 10)
      onChange(
        updateHomepageSectionContent(sections, section.type, {
          productLimit: Number.isFinite(n) ? n : undefined,
        })
      )
      return
    }
    onChange(
      updateHomepageSectionContent(sections, section.type, {
        [field]: raw.trim() ? raw : undefined,
      })
    )
  }

  return (
    <div className="mt-2 space-y-2 border-t border-violet-200/60 pt-2 dark:border-violet-900/40">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
        {t("title")}
      </p>
      {fields.map((field) => (
        <label key={field} className="block space-y-1">
          <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">
            {t(`fields.${field}`)}
          </span>
          {field === "body" || field === "quote" ? (
            <textarea
              value={section.content?.[field] ?? ""}
              rows={3}
              onChange={(e) => patch(field, e.target.value)}
              placeholder={t(`placeholders.${field}`)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-900 outline-none focus:border-violet-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          ) : (
            <Input
              value={
                field === "productLimit"
                  ? String(section.content?.productLimit ?? "")
                  : (section.content?.[field] ?? "")
              }
              type={field === "productLimit" ? "number" : "text"}
              min={field === "productLimit" ? 4 : undefined}
              max={field === "productLimit" ? 8 : undefined}
              onChange={(e) => patch(field, e.target.value)}
              placeholder={t(`placeholders.${field}`)}
              className="h-9 text-xs"
            />
          )}
        </label>
      ))}
      <p className="text-[10px] text-gray-500 dark:text-zinc-500">{t("resetHint")}</p>
    </div>
  )
}
