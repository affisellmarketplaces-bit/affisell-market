import Link from "next/link"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { isRadarEnabled } from "@/lib/radar/gate"
import { getUserRadarPlan, toRadarPlanUser } from "@/lib/radar/plans"

export const dynamic = "force-dynamic"

const LINKS = [
  { href: "/radar/map", label: "🗺️ Map Monde", desc: "Winners live par pays (paywall bypass ADMIN)" },
  { href: "/radar", label: "Dashboard", desc: "Sources + signal actif" },
  { href: "/radar/winners", label: "Winners", desc: "Liste winners détectés" },
  { href: "/radar/alerts", label: "Alertes", desc: "Inbox + Slack Global" },
  { href: "/radar/connect", label: "Connect", desc: "TikTok / Amazon / Google" },
  { href: "/pricing?feature=radar", label: "Pricing", desc: "Page upgrade publique" },
] as const

/** Admin QA console for Affisell Radar — ADMIN gets Radar Global entitlements. */
export default async function AdminRadarPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login/admin?callbackUrl=/admin/radar")

  const plan = getUserRadarPlan(toRadarPlanUser(session.user))
  const enabled = isRadarEnabled()

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Admin · QA</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">Affisell Radar</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Compte <span className="font-medium">ADMIN</span> = accès{" "}
        <span className="font-medium text-emerald-700 dark:text-emerald-400">Radar Global</span>{" "}
        (Map, alertes, Slack) sans Stripe — pour tester le produit.
      </p>

      <div className="mt-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-3">
        <div>
          <p className="text-xs text-zinc-500">Flag</p>
          <p className="mt-1 font-medium">{enabled ? "RADAR_ENABLED=on" : "RADAR_ENABLED=off"}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Plan résolu</p>
          <p className="mt-1 font-medium">{plan.name}</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Map / Slack</p>
          <p className="mt-1 font-medium">
            {plan.hasMap ? "Map ✓" : "Map —"} · {plan.hasSlack ? "Slack ✓" : "Slack —"}
          </p>
        </div>
      </div>

      {!enabled ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Radar est désactivé sur cet environnement. Active{" "}
          <code className="text-xs">RADAR_ENABLED=true</code> (Vercel / .env.local) puis redeploy.
        </p>
      ) : null}

      <ul className="mt-8 space-y-3">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex flex-col rounded-xl border border-zinc-200 bg-white px-4 py-3 transition hover:border-violet-300 hover:bg-violet-50/50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-violet-700 dark:hover:bg-violet-950/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{link.label}</span>
              <span className="text-xs text-zinc-500 sm:text-sm">{link.desc}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-zinc-500">
        Après login admin, si le paywall reste visible : recharge la session (déconnexion / reconnexion)
        pour rafraîchir les features JWT.
      </p>
    </main>
  )
}
