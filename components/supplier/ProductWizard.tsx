"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { ChevronRight, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  useSupplierProductWizardStore,
  type WizardStep,
} from "@/stores/supplier-product-wizard-store"
import { cn } from "@/lib/utils"

type BreadcrumbItem = { label: string; href?: string }

type Props = {
  children: ReactNode
  qualityPanel: ReactNode
  breadcrumb: BreadcrumbItem[]
  onSaveDraft?: () => void
  savingDraft?: boolean
  onBack?: () => void
}

export function ProductWizard({
  children,
  qualityPanel,
  breadcrumb,
  onSaveDraft,
  savingDraft,
  onBack,
}: Props) {
  const t = useTranslations("supplier.wizard")
  const step = useSupplierProductWizardStore((s) => s.step)
  const step1Valid = useSupplierProductWizardStore((s) => s.step1Valid)
  const step2Valid = useSupplierProductWizardStore((s) => s.step2Valid)
  const trySetStep = useSupplierProductWizardStore((s) => s.trySetStep)

  const STEPS: { n: WizardStep; title: string; hint: string }[] = [
    { n: 1, title: t("step1Title"), hint: t("step1Hint") },
    { n: 2, title: t("step2Title"), hint: t("step2Hint") },
    { n: 3, title: t("step3Title"), hint: t("step3Hint") },
  ]

  const handleStepClick = (n: WizardStep) => {
    if (n === step) return
    if (!trySetStep(n)) return
  }

  const stepLocked = (n: WizardStep) => {
    if (n === 1) return false
    if (n === 2) return !step1Valid
    return !step1Valid || !step2Valid
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-4 border-b border-zinc-200/80 pb-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label={t("breadcrumbAria")} className="min-w-0 flex-1">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            {breadcrumb.map((item, i) => (
              <li key={`${item.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden /> : null}
                {item.href ? (
                  <Link
                    href={item.href}
                    className="font-medium text-zinc-700 transition hover:text-violet-700 dark:text-zinc-300 dark:hover:text-violet-300"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{item.label}</span>
                )}
              </li>
            ))}
          </ol>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mt-2 text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
            >
              {t("backToMethods")}
            </button>
          ) : null}
        </nav>
        {onSaveDraft ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={savingDraft}
            onClick={onSaveDraft}
            className="shrink-0 gap-2 self-start sm:self-center"
          >
            {savingDraft ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {t("save")}
          </Button>
        ) : null}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(200px,15rem)_1fr] lg:gap-8">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <nav aria-label={t("stepsAria")} className="hidden lg:block">
            <ol className="space-y-1">
              {STEPS.map(({ n, title, hint }) => {
                const locked = stepLocked(n)
                const active = step === n
                const done = n === 1 ? step1Valid && step > 1 : n === 2 ? step2Valid && step > 2 : false
                return (
                  <li key={n}>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => handleStepClick(n)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition",
                        active
                          ? "bg-violet-100/90 ring-1 ring-violet-300/80 dark:bg-violet-950/50 dark:ring-violet-700/60"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                        locked && "cursor-not-allowed opacity-45"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          active
                            ? "bg-violet-600 text-white"
                            : done
                              ? "bg-emerald-600 text-white"
                              : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        )}
                      >
                        {n}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
          {qualityPanel}
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
