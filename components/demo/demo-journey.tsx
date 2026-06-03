import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowRight, Lock } from "lucide-react"

import { DemoFeedbackForm } from "@/components/demo/demo-feedback-form"
import { DemoSandboxPortalSection } from "@/components/demo/demo-sandbox-portal-section"
import {
  DEMO_JOURNEY_STEPS,
  type DemoJourneyStep,
  type DemoPersonaKey,
} from "@/lib/demo/demo-shared"
import { cn } from "@/lib/utils"

type Props = {
  persona: DemoPersonaKey
}

export async function DemoJourney({ persona }: Props) {
  const t = await getTranslations("demoLab")
  const steps = DEMO_JOURNEY_STEPS[persona]

  return (
    <div className="space-y-10">
      <header className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-zinc-950 via-violet-950/90 to-zinc-900 p-6 text-white sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-300/90">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {t(`personas.${persona}.title`)}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
          {t(`personas.${persona}.subtitle`)}
        </p>
        <p className="mt-4 text-xs text-amber-200/90">{t("sandboxNotice")}</p>
      </header>

      <DemoSandboxPortalSection focusPersona={persona} />

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <DemoStepCard key={step.id} step={step} index={index + 1} t={t} />
        ))}
      </ol>

      <DemoFeedbackForm
        persona={persona}
        labels={{
          title: t("feedback.title"),
          subtitle: t("feedback.subtitle"),
          scoreAria: t("feedback.scoreAria"),
          commentPlaceholder: t("feedback.commentPlaceholder"),
          emailPlaceholder: t("feedback.emailPlaceholder"),
          submit: t("feedback.submit"),
          thanks: t("feedback.thanks"),
          error: t("feedback.error"),
        }}
      />
    </div>
  )
}

function DemoStepCard({
  step,
  index,
  t,
}: {
  step: DemoJourneyStep
  index: number
  t: Awaited<ReturnType<typeof getTranslations<"demoLab">>>
}) {
  const title = t(step.titleKey)
  const body = t(step.bodyKey)

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-5 sm:flex-row sm:items-center sm:justify-between",
        "dark:border-zinc-800 dark:bg-zinc-950/80"
      )}
    >
      <div className="flex min-w-0 gap-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200"
          aria-hidden
        >
          {index}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
          {step.requiresAuth ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500">
              <Lock className="h-3 w-3" aria-hidden />
              {t("requiresAuth")}
            </p>
          ) : null}
        </div>
      </div>
      <Link
        href={step.href}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-900 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-950"
      >
        {t("tryStep")}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </li>
  )
}
