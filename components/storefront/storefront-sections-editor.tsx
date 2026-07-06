"use client"

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, LayoutList, Pencil } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { StorefrontSectionContentPanel } from "@/components/storefront/storefront-section-content-panel"
import { StorefrontFlashSalePanel } from "@/components/storefront/storefront-flash-sale-panel"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import {
  HOMEPAGE_SECTION_TYPES,
  reorderHomepageSections,
  toggleHomepageSection,
  type HomepageSection,
  type HomepageSectionType,
} from "@/lib/storefront-sections-shared"
import { cn } from "@/lib/utils"

type Props = {
  sections: HomepageSection[]
  onChange: (sections: HomepageSection[]) => void
}

type SortableRowProps = {
  section: HomepageSection
  index: number
  expanded: HomepageSectionType | null
  sections: HomepageSection[]
  onChange: (sections: HomepageSection[]) => void
  onToggleExpand: (type: HomepageSectionType) => void
}

function SortableSectionRow({
  section,
  index,
  expanded,
  sections,
  onChange,
  onToggleExpand,
}: SortableRowProps) {
  const t = useTranslations("storefront.brandStudio.sections")
  const label = t(`types.${section.type}.label`)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.type,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl border px-3 py-2.5",
        isDragging && "z-10 shadow-lg ring-2 ring-violet-400/40",
        section.enabled
          ? "border-violet-200/80 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20"
          : "border-gray-200 bg-white/50 dark:border-zinc-800 dark:bg-zinc-950/30"
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="touch-none rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label={t("dragHandle", { section: label, position: index + 1 })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">{label}</p>
          <p className="text-[11px] text-gray-500 dark:text-zinc-400">
            {t(`types.${section.type}.desc`)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {section.enabled ? (
            <button
              type="button"
              aria-expanded={expanded === section.type}
              aria-label={t("editContent", { section: label })}
              onClick={() => onToggleExpand(section.type)}
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
            role="switch"
            aria-checked={section.enabled}
            aria-label={t(section.enabled ? "disable" : "enable", { section: label })}
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
        section.type === "flash-sale" ? (
          <StorefrontFlashSalePanel sections={sections} onChange={onChange} />
        ) : (
          <StorefrontSectionContentPanel section={section} sections={sections} onChange={onChange} />
        )
      ) : null}
    </li>
  )
}

export function StorefrontSectionsEditor({ sections, onChange }: Props) {
  const t = useTranslations("storefront.brandStudio.sections")
  const [expanded, setExpanded] = useState<HomepageSectionType | null>(null)

  const sectionIds = useMemo(() => sections.map((s) => s.type), [sections])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = sections.findIndex((s) => s.type === active.id)
    const toIndex = sections.findIndex((s) => s.type === over.id)
    if (fromIndex < 0 || toIndex < 0) return
    const next = reorderHomepageSections(sections, fromIndex, toIndex)
    onChange(next)
    capturePosthogClient("brand_sections_reordered", {
      fromType: String(active.id),
      toIndex,
      enabledCount: next.filter((s) => s.enabled).length,
    })
    console.log("[brand-studio]", {
      event: "sections_reordered",
      fromType: active.id,
      toIndex,
      result: "ok",
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">
          <LayoutList className="size-4 text-violet-600" aria-hidden />
          {t("title")}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{t("hint")}</p>
        <p className="mt-1 text-[11px] text-violet-700 dark:text-violet-300">{t("dragHint")}</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {sections.map((section, index) => (
              <SortableSectionRow
                key={section.type}
                section={section}
                index={index}
                expanded={expanded}
                sections={sections}
                onChange={onChange}
                onToggleExpand={(type) =>
                  setExpanded((prev) => (prev === type ? null : type))
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <p className="text-[11px] text-gray-500 dark:text-zinc-500">
        {t("orderHint", { count: HOMEPAGE_SECTION_TYPES.length })}
      </p>
    </div>
  )
}
