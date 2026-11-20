"use client"

import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  RETURN_INSPECTION_OUTCOMES,
  type DispositionEvent,
  type DispositionStage,
  type ReturnInspectionOutcome,
} from "@/lib/return-disposition"

type Timeline = { events: DispositionEvent[]; stage: DispositionStage; restockMode: "off" | "observe" | "enforce" }

const ERROR_KEY: Record<string, string> = {
  not_resellable: "errNotResellable",
  not_inspected: "errNotInspected",
  already_restocked: "errAlreadyRestocked",
}

/**
 * Supplier — what happens to the GOODS of a received return, in two traced steps: an inspection (observed state,
 * never touches stock) and a decision (restock / keep out). The restock itself follows the platform switch.
 */
export function ReturnDispositionBlock({ returnId }: { returnId: string }) {
  const t = useTranslations("supplierReturns.disposition")
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [outcome, setOutcome] = useState<ReturnInspectionOutcome>("resellable")
  const [note, setNote] = useState("")
  const [decisionNote, setDecisionNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/supplier/returns/${encodeURIComponent(returnId)}/disposition`, { cache: "no-store" })
    if (res.ok) setTimeline((await res.json()) as Timeline)
  }, [returnId])

  useEffect(() => {
    void load()
  }, [load])

  async function send(path: string, body: Record<string, unknown>, ok: (json: Record<string, unknown>) => string) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/supplier/returns/${encodeURIComponent(returnId)}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      setMessage(res.ok ? ok(json) : t(ERROR_KEY[String(json.error)] ?? "error"))
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!timeline) return null
  const stage = timeline.stage
  const canInspect = stage !== "restocked" && stage !== "awaiting_reception"
  const canDecide = stage === "awaiting_decision" || stage === "inspected_not_resellable"

  return (
    <div className="mt-3 w-full space-y-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{t("title")}</p>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{t(`stage.${stage}`)}</span>
      </div>

      {canInspect ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
          <label className="text-xs text-zinc-500">
            {t("outcomeLabel")}
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent p-1.5 text-sm dark:border-zinc-700"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as ReturnInspectionOutcome)}
            >
              {RETURN_INSPECTION_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {t(`outcome.${o}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-500">
            {t("noteLabel")}
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent p-1.5 text-sm dark:border-zinc-700"
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void send("inspection", { outcome, note }, () => t("inspectionSaved"))}
          >
            {t("record")}
          </Button>
        </div>
      ) : null}

      {canDecide ? (
        <div className="space-y-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <label className="block text-xs text-zinc-500">
            {t("decisionNoteLabel")}
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent p-1.5 text-sm dark:border-zinc-700"
              value={decisionNote}
              maxLength={1000}
              onChange={(e) => setDecisionNote(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {stage === "awaiting_decision" ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void send("disposition", { decision: "restock", note: decisionNote }, (j) =>
                    j.restock === "restocked" ? t("restocked") : t("decisionSaved")
                  )
                }
              >
                {t("decideRestock")}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void send("disposition", { decision: "keep_out", note: decisionNote }, () => t("decisionSaved"))}
            >
              {t("decideKeepOut")}
            </Button>
          </div>
          {timeline.restockMode !== "enforce" ? (
            <p className="text-xs text-zinc-500">{timeline.restockMode === "observe" ? t("modeObserve") : t("modeOff")}</p>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="text-xs text-zinc-700 dark:text-zinc-300">{message}</p> : null}

      {timeline.events.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-zinc-500">{t("timeline")}</p>
          <ol className="mt-1 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            {timeline.events.map((e, i) => (
              <li key={`${e.kind}-${e.at}-${i}`}>
                {new Date(e.at).toLocaleString()} —{" "}
                {e.kind === "inspected"
                  ? `${t("event.inspected")} : ${t(`outcome.${e.outcome}`)}${e.note ? ` (${e.note})` : ""}`
                  : e.kind === "decided"
                    ? `${t("event.decided")} : ${t(`decision.${e.decision}`)}${e.note ? ` (${e.note})` : ""}`
                    : e.kind === "restocked"
                      ? t("event.restocked", { qty: e.qty })
                      : t("event.received")}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}
