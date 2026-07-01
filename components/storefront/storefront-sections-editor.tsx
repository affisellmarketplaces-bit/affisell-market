"use client"

import { ChevronDown, ChevronUp, LayoutList, Pencil } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { StorefrontSectionContentPanel } from "@/components/storefront/storefront-section-content-panel"
import {
  HOMEPAGE_SECTION_TYPES,
  moveHomepageSection,
  toggleHomepageSection,
  type HomepageSection,
  type HomepageSectionType,
} from "@/lib/storefront-sections-shared"
import { cn } from "@/lib/utils"

type Props = {
  sections: HomepageSection[]
  onChange: (sections: HomepageSection[]) => void
}

export function StorefrontSectionsEditor({ sections, onChange }: Props) {
  const t = useTranslations("storefront.brandStudio.sections")
  const [expanded, setExpanded] = useState<HomepageSectionType | null>(null)

  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">
          <LayoutList className="size-4 text-violet-600" aria-hidden />
          {t("title")}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{t("hint")}</p>
        <p className="mt-1 text-[11px] text-violet-700 dark:text-violet-300">{t("phase3Hint")}</p>
      </div>

      <ul className="space-y-2">
        {sections.map((section, index) => (
          <li
            key={section.type}
            className={cn(
              "rounded-xl border px-3 py-2.5",
              section.enabled
                ? "border-violet-200/80 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20"
                : "border-gray-200 bg-white/50 dark:border-zinc-800 dark:bg-zinc-950/30"
            )}
          >
            <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                {t(`types.${section.type}.label`)}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                {t(`types.${section.type}.desc`)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {section.enabled ? (
                <button
                  type="button"
                  aria-expanded={expanded === section.type}
                  aria-label={t("editContent", { section: t(`types.${section.type}.label`) })}
                  onClick={() =>
                    setExpanded((prev) => (prev === section.type ? null : section.type))
                  }
                  className={cn(
                    "rounded-lg p-1.5 transition",
                    expanded === section.type
                      ? "bg-violet-600 text-white"
                      : "text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                aria-label={t("moveUp")}
                disabled={index === 0}
                onClick={() => onChange(moveHomepageSection(sections, index, "up"))}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-zinc-800"
              >
                <ChevronUp className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t("moveDown")}
                disabled={index === sections.length - 1}
                onClick={() => onChange(moveHomepageSection(sections, index, "down"))}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-zinc-800"
              >
                <ChevronDown className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={section.enabled}
                aria-label={t(section.enabled ? "disable" : "enable", {
                  section: t(`types.${section.type}.label`),
                })}
                onClick={() =>
                  onChange(toggleHomepageSection(sections, section.type, !section.enabled))
                }
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition",
                  section.enabled ? "bg-violet-600" : "bg-gray-300 dark:bg-zinc-700"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-6 rounded-full bg-white shadow transition",
                    section.enabled ? "left-[1.35rem]" : "left-0.5"
                  )}
                  aria-hidden
                />
              </button>
            </div>
            </div>
            {section.enabled && expanded === section.type ? (
              <StorefrontSectionContentPanel
                section={section}
                sections={sections}
                onChange={onChange}
              />
            ) : null}
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-gray-500 dark:text-zinc-500">
        {t("orderHint", { count: HOMEPAGE_SECTION_TYPES.length })}
      </p>
    </div>
  )
}
