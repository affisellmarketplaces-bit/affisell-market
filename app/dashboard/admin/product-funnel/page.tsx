import type { Metadata } from "next"
import Link from "next/link"

import { posthogAppHostFromCaptureHost } from "@/lib/storefront-brand-analytics-shared"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Product funnel | Affisell Admin",
  robots: { index: false, follow: false },
}

const EVENTS = [
  "wizard_v2_view",
  "wizard_v2_step_complete",
  "wizard_v2_publish_success",
  "wizard_v2_publish_blocked",
  "wizard_v2_abandon",
] as const

export default function AdminProductFunnelPage() {
  const posthogHost = posthogAppHostFromCaptureHost(
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"
  )
  const projectId = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID?.trim()

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Product wizard funnel</h1>
        <p className="mt-1 text-sm text-zinc-500">
          PostHog events for Add Product Wizard v2 — compare time_to_publish p50 before/after rollout.
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
      </section>

      <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 dark:border-violet-900/50 dark:bg-violet-950/30">
        <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-100">PostHog dashboard</h2>
        <p className="mt-2 text-sm text-violet-900/80 dark:text-violet-200/80">
          Create a funnel: <strong>wizard_v2_view</strong> → <strong>wizard_v2_publish_success</strong>.
          Break down by <code>mode</code> (express / guided). Alert if{" "}
          <code>wizard_v2_publish_blocked</code> rate &gt; 15%.
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
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Rollout kill switch</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          <code>ENABLE_WIZARD_V2=0</code> on Vercel → redeploy. Users can still open v1 via{" "}
          <code>?wizard=v1</code>.
        </p>
      </section>
    </main>
  )
}
