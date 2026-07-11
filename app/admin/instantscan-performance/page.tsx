import type { Metadata } from "next"
import Link from "next/link"

import { posthogAppHostFromCaptureHost } from "@/lib/storefront-brand-analytics-shared"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "InstantScan performance | Affisell Admin",
  robots: { index: false, follow: false },
}

const EVENTS = ["instant_scan_result", "instant_scan_trigger_attempt", "instant_scan_api_called", "instant_scan_error", "instant_scan_gate_triggered"] as const

export default function AdminInstantScanPerformancePage() {
  const posthogHost = posthogAppHostFromCaptureHost(
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"
  )
  const projectId = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID?.trim()

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Affisell InstantScan</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cascade IA temps réel — précision, latence p95 et taux de gate par stage (embed / gpt4o).
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Tracked events</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {EVENTS.map((e) => (
            <li key={e}>
              <code className="text-violet-700 dark:text-violet-300">{e}</code>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          <code>instant_scan_result</code> — props: <code>model</code>, <code>confidence</code>,{" "}
          <code>latency_ms</code>, <code>stage</code>. Also: <code>instant_scan_trigger_attempt</code>,{" "}
          <code>instant_scan_api_called</code>, <code>instant_scan_error</code>.
        </p>
      </section>

      <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 dark:border-violet-900/50 dark:bg-violet-950/30">
        <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-100">PostHog dashboard</h2>
        <p className="mt-2 text-sm text-violet-900/80 dark:text-violet-200/80">
          Cible prod : précision &gt;98.5%, latence p95 &lt;2 s, coût ~0.003 $/analyse. Créez une
          insight <strong>instant_scan_result</strong> avec p95 <code>latency_ms</code> par{" "}
          <code>stage</code>. Alerte si <code>instant_scan_gate_triggered</code> &gt; 8%.
        </p>
        {projectId ? (
          <Link
            href={`${posthogHost}/project/${projectId}/insights`}
            className="mt-3 inline-block text-sm font-medium text-violet-700 underline dark:text-violet-300"
          >
            Open PostHog insights →
          </Link>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">Set NEXT_PUBLIC_POSTHOG_PROJECT_ID for a direct link.</p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Feature flags</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          <code>ENABLE_INSTANTSCAN=1</code> — InstantScan cascade (CLIP → mini → GPT-4o). Retrocompat :{" "}
          <code>ENABLE_AI_VISION_V2=1</code> + <code>ENABLE_AI_VISION_CASCADE=1</code> when{" "}
          <code>ENABLE_INSTANTSCAN=0</code>.
        </p>
      </section>
    </main>
  )
}
