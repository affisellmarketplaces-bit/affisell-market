"use client"

import { useState } from "react"
import Image from "next/image"
import { ChevronDown, Images } from "lucide-react"

import type { AgentMissionRow } from "@/lib/agents/load-agent-network"
import type { AgentMissionTypeValue } from "@/lib/agents/agent-network-shared"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "border-amber-400/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ASSIGNED: "border-sky-400/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  IN_PROGRESS: "border-violet-400/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
  PASSED: "border-emerald-400/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  FAILED: "border-red-400/30 bg-red-500/15 text-red-700 dark:text-red-300",
  CANCELLED: "border-zinc-400/30 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400",
}

type Props = {
  mission: AgentMissionRow
  statusLabel: (status: string) => string
  typeLabel: (type: AgentMissionTypeValue) => string
  autoBuyPausedLabel: string
  formatPhotosLabel: (count: number) => string
}

function flag(country: string): string {
  const code = country.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return "🌐"
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function AgentMissionReportCard({
  mission: m,
  statusLabel,
  typeLabel,
  autoBuyPausedLabel,
  formatPhotosLabel,
}: Props) {
  const [open, setOpen] = useState(
    m.status === "PASSED" || m.status === "FAILED" || m.photoUrls.length > 0
  )
  const hasReport = Boolean(m.reportSummary?.trim()) || m.photoUrls.length > 0

  return (
    <li className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
            STATUS_STYLES[m.status] ?? ""
          )}
        >
          {statusLabel(m.status)}
        </span>
        <span className="text-xs font-medium text-zinc-100">{typeLabel(m.type)}</span>
        {m.autoBuyPaused ? (
          <span className="rounded-full border border-red-400/30 bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-300">
            {autoBuyPausedLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-1 truncate text-xs text-zinc-400">
        {m.productName ?? "—"}
        {m.agentName ? (
          <>
            {" · "}
            <span aria-hidden>{flag(m.agentCountry ?? "")}</span> {m.agentName} ({m.agentCity})
          </>
        ) : null}
      </p>

      {hasReport ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-cyan-300 hover:underline"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
            {m.photoUrls.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Images className="h-3.5 w-3.5" />
                {formatPhotosLabel(m.photoUrls.length)}
              </span>
            ) : (
              "Voir le rapport"
            )}
          </button>
          {open ? (
            <div className="mt-2 space-y-2">
              {m.reportSummary ? (
                <p className="rounded-lg bg-black/20 px-3 py-2 text-xs italic text-zinc-200">
                  « {m.reportSummary} »
                </p>
              ) : null}
              {m.photoUrls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {m.photoUrls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block h-20 w-20 overflow-hidden rounded-lg border border-white/10"
                    >
                      <Image src={url} alt="" fill className="object-cover" sizes="80px" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : m.reportSummary ? (
        <p className="mt-1 text-xs italic text-zinc-300">« {m.reportSummary} »</p>
      ) : null}
    </li>
  )
}
