"use client"

import { Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  STOREFRONT_STATIC_PAGE_KINDS,
  updateStaticPage,
  type StorefrontFaqItem,
  type StorefrontStaticPageKind,
  type StorefrontStaticPages,
} from "@/lib/storefront-static-pages-shared"
import { cn } from "@/lib/utils"

type Props = {
  pages: StorefrontStaticPages
  onChange: (pages: StorefrontStaticPages) => void
}

export function StorefrontStaticPagesEditor({ pages, onChange }: Props) {
  const t = useTranslations("storefront.brandStudio.staticPages")

  function patchPage(kind: StorefrontStaticPageKind, patch: Parameters<typeof updateStaticPage>[2]) {
    onChange(updateStaticPage(pages, kind, patch))
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t("title")}</p>
        <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{t("hint")}</p>
      </div>

      {STOREFRONT_STATIC_PAGE_KINDS.map((kind) => {
        const page = pages[kind]
        return (
          <div
            key={kind}
            className={cn(
              "rounded-2xl border p-4 transition",
              page.enabled
                ? "border-violet-300/70 bg-violet-50/40 dark:border-violet-900/50 dark:bg-violet-950/20"
                : "border-gray-200 dark:border-zinc-800"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {t(`kinds.${kind}.label`)}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t(`kinds.${kind}.hint`)}</p>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={page.enabled}
                  onChange={(e) => patchPage(kind, { enabled: e.target.checked })}
                  className="size-4 rounded border-gray-300 accent-violet-600"
                />
                {t("enable")}
              </label>
            </div>

            {page.enabled ? (
              <div className="mt-4 space-y-3">
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">
                    {t("fields.title")}
                  </span>
                  <Input
                    value={page.title ?? ""}
                    onChange={(e) => patchPage(kind, { title: e.target.value })}
                    placeholder={t(`kinds.${kind}.titlePlaceholder`)}
                  />
                </label>

                {kind === "faq" ? (
                  <FaqEditor
                    items={page.faqItems ?? []}
                    onChange={(faqItems) => patchPage(kind, { faqItems })}
                  />
                ) : (
                  <label className="block space-y-1">
                    <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">
                      {t("fields.body")}
                    </span>
                    <textarea
                      rows={5}
                      value={page.body ?? ""}
                      onChange={(e) => patchPage(kind, { body: e.target.value })}
                      placeholder={t(`kinds.${kind}.bodyPlaceholder`)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                )}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function FaqEditor({
  items,
  onChange,
}: {
  items: StorefrontFaqItem[]
  onChange: (items: StorefrontFaqItem[]) => void
}) {
  const t = useTranslations("storefront.brandStudio.staticPages")

  function updateItem(index: number, patch: Partial<StorefrontFaqItem>) {
    onChange(items.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function addItem() {
    if (items.length >= 12) return
    onChange([...items, { question: "", answer: "" }])
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">{t("fields.faq")}</p>
      {items.map((item, index) => (
        <div
          key={`faq-${index}`}
          className="space-y-2 rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-950/60"
        >
          <Input
            value={item.question}
            onChange={(e) => updateItem(index, { question: e.target.value })}
            placeholder={t("fields.question")}
          />
          <textarea
            rows={2}
            value={item.answer}
            onChange={(e) => updateItem(index, { answer: e.target.value })}
            placeholder={t("fields.answer")}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
            <Trash2 className="size-3.5" aria-hidden />
            {t("removeFaq")}
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={items.length >= 12}>
        <Plus className="size-3.5" aria-hidden />
        {t("addFaq")}
      </Button>
    </div>
  )
}
