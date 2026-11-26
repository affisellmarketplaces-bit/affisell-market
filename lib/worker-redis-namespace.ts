/**
 * Start-up report of the Redis namespace a BullMQ worker is going to use (finalisation master K1, review follow-up #13/#30).
 *
 * The risk: K1 puts every queue under the environment's namespace — Vercel Production enqueues on `bull:<queue>:…` (empty namespace). A
 * worker HOSTED outside Vercel resolves its namespace from its own environment (`lib/redis-namespace.ts`): without `NODE_ENV=production`
 * (nothing sets it for `tsx workers/auto-order-worker.ts`) and without `AFFISELL_REDIS_NAMESPACE`, it resolves to `dev:` and listens on
 * `dev:bull:<queue>:…`. It starts cleanly, prints "listening", connects, idles — and every paid order's purchase / fulfilment job sits
 * unconsumed under `bull:*`, with no error anywhere.
 *
 * Nothing can know from the inside that a host is MEANT to be production, so the worker says what it uses and shouts when that was a default:
 *
 *   - always: ONE info line with the namespace actually used (names only: no URL, no key, no token);
 *   - namespace not production AND `AFFISELL_REDIS_NAMESPACE` not set to a valid value: an ERROR line AND an ops alert (Slack / Discord
 *     via `lib/ops-webhook.ts`, which is a no-op when neither webhook is configured). It does NOT exit: a visible alert beats a crash loop in
 *     production that would also stop the queues that ARE being consumed correctly.
 *
 * On a developer machine `dev:` is the intended isolation (the alert is then noise, and the text says so); a laptop that runs a worker
 * with Slack configured is rare, and silently skipping the alert on "developer machines" would re-open the hole on a self-managed host
 * that happens to hold a `.env` file. Never throws. Pure apart from `console` and the injected alert. No `server-only`.
 */
import { diagnoseRedisNamespace, REDIS_NAMESPACE_VARIABLE, type RedisNamespaceDiagnosis } from "@/lib/redis-namespace"

type EnvBag = Record<string, string | undefined>

export type WorkerNamespaceReport = RedisNamespaceDiagnosis & {
  /** An alert was handed to the ops webhook (it may still have reached nobody if no webhook is configured). */
  alerted: boolean
}

export type WorkerNamespaceOptions = {
  env?: EnvBag
  /** Test seam; default: `opsWebhookAlert` from `lib/ops-webhook.ts` (loaded on demand). */
  alert?: (text: string) => Promise<unknown>
  /** The alert never delays the worker's start by more than this. */
  alertTimeoutMs?: number
}

/** The alert text. Variable NAMES and namespaces only. */
export function workerNamespaceAlertText(workerName: string, diagnosis: RedisNamespaceDiagnosis): string {
  return (
    `[${workerName}] ATTENTION — ce worker écoute le namespace Redis "${diagnosis.label}" (préfixe BullMQ "${diagnosis.bullmqPrefix}"), ` +
    `déduit de l'environnement (${diagnosis.environment}) et non choisi. Vercel Production met ses tâches dans "bull" : si cet hôte est un worker ` +
    `de PRODUCTION, aucune tâche d'achat ni de fulfilment n'est consommée, sans aucune erreur. Correction : définir NODE_ENV=production sur cet hôte ` +
    `(recommandé : cela règle aussi la garde de clé Stripe live) ou ${REDIS_NAMESPACE_VARIABLE}=production. ` +
    `Sur un poste de développement, "dev" est le comportement voulu : ignorer cette alerte.`
  )
}

/**
 * Call once at worker start, BEFORE the BullMQ workers are created. Returns the diagnosis; never throws; never exits the process.
 */
export async function reportWorkerRedisNamespace(workerName: string, options: WorkerNamespaceOptions = {}): Promise<WorkerNamespaceReport> {
  const env = options.env ?? process.env
  let diagnosis: RedisNamespaceDiagnosis = {
    environment: "development",
    namespace: "",
    label: "unknown",
    bullmqPrefix: "unknown",
    explicit: false,
    notExplicitlyChosen: false,
  }
  let alerted = false

  try {
    diagnosis = diagnoseRedisNamespace(env)
    console.info(`[${workerName}] redis_namespace`, {
      namespace: diagnosis.label,
      bullmqPrefix: diagnosis.bullmqPrefix,
      environment: diagnosis.environment,
      explicit: diagnosis.explicit,
    })

    if (diagnosis.notExplicitlyChosen) {
      const text = workerNamespaceAlertText(workerName, diagnosis)
      console.error(`[${workerName}] redis_namespace_not_production`, {
        namespace: diagnosis.label,
        bullmqPrefix: diagnosis.bullmqPrefix,
        environment: diagnosis.environment,
        variable: REDIS_NAMESPACE_VARIABLE,
        message: text,
      })

      const alert = options.alert ?? (async (t: string) => (await import("@/lib/ops-webhook")).opsWebhookAlert(t))
      const timeoutMs = options.alertTimeoutMs ?? 5_000
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          alert(text),
          new Promise<void>((resolve) => {
            timer = setTimeout(resolve, timeoutMs)
          }),
        ])
        alerted = true
      } catch {
        console.error(`[${workerName}] redis_namespace_alert_failed`)
      } finally {
        if (timer) clearTimeout(timer)
      }
    }
  } catch {
    console.error(`[${workerName}] redis_namespace_report_failed`)
  }

  return { ...diagnosis, alerted }
}
