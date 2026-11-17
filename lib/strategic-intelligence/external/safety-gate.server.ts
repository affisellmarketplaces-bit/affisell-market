import "server-only"

import {
  parseWeeklyReport,
  parseWeeklyReportList,
  SAFETY_GATE_LIST_URL,
  safetyGateReportUrl,
  type SafetyGateAlert,
  type WeeklyReportRef,
} from "@/lib/strategic-intelligence/external/safety-gate"

const MAX_LIST_BYTES = 3_000_000
const MAX_REPORT_BYTES = 4_000_000
/** The latest two weekly reports: the current week and the previous one (a report can be read late). */
export const SAFETY_GATE_REPORTS_READ = 2

async function getText(url: string, maxBytes: number, code: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    // Weekly publication: 12 h of cache = at most 2 × (1 + 2) requests a day.
    next: { revalidate: 43_200 },
    headers: { accept: "application/xml,text/xml" },
  })
  if (!res.ok) throw new Error(`${code}_http_${res.status}`)
  const text = await res.text()
  if (text.length > maxBytes) throw new Error(`${code}_too_large`)
  return text
}

/**
 * Reads the official list of weekly reports, then the latest ones (URLs rebuilt from the numeric id, never taken from
 * the file). Throws on any failure so the cockpit reports the source as not verified this run.
 */
export async function fetchLatestSafetyGateAlerts(): Promise<{ reports: WeeklyReportRef[]; alerts: SafetyGateAlert[] }> {
  const list = parseWeeklyReportList(await getText(SAFETY_GATE_LIST_URL, MAX_LIST_BYTES, "safety_gate_list"))
  if (list.length === 0) throw new Error("safety_gate_list_unparseable")
  const reports = list.slice(0, SAFETY_GATE_REPORTS_READ)
  const alerts: SafetyGateAlert[] = []
  for (const r of reports) {
    const parsed = parseWeeklyReport(await getText(safetyGateReportUrl(r.id), MAX_REPORT_BYTES, "safety_gate_report"))
    if (parsed.length === 0) throw new Error("safety_gate_report_unparseable")
    alerts.push(...parsed)
  }
  const seen = new Set<string>()
  return { reports, alerts: alerts.filter((a) => (seen.has(a.caseNumber) ? false : (seen.add(a.caseNumber), true))) }
}
