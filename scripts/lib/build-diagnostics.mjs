/**
 * Build diagnostics — make a stopped build say WHY it stopped.
 *
 * Measured on 2026-11-28: on an 8 GB machine `next build` is killed by the kernel's OOM killer (SIGKILL) during the
 * Turbopack compile. The wrapper used to turn that signal into a bare "exit 1", so the Vercel log showed no reason.
 * This module: reads the machine's memory limit (cgroup v2, cgroup v1, else /proc/meminfo), samples the memory in use
 * during the build, and turns an exit into one explicit line. It only READS /proc and /sys: no side effect, no network.
 */
import { readFileSync } from "node:fs"
import { cpus } from "node:os"

const GB = 1024 ** 3
const read = (path) => {
  try {
    return readFileSync(path, "utf8").trim()
  } catch {
    return null
  }
}
/** A cgroup "no limit" is "max" (v2) or a huge sentinel (v1, ~2^63). */
const limitOf = (raw) => {
  if (raw === null || raw === "max") return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 && n < 2 ** 60 ? n : null
}

/** @returns {number | null} bytes */
export function parseMeminfo(text, key) {
  const m = new RegExp(`^${key}:\\s+(\\d+) kB$`, "m").exec(String(text ?? ""))
  return m ? Number(m[1]) * 1024 : null
}

/**
 * The memory this build may use and what it uses now, from the most precise source available.
 * @param {(path: string) => string | null} [readFile]
 * @returns {{ source: "cgroup2" | "cgroup1" | "meminfo" | "none", limitBytes: number | null, usedBytes: number | null }}
 */
export function readMemory(readFile = read) {
  const total = parseMeminfo(readFile("/proc/meminfo"), "MemTotal")
  const v2limit = readFile("/sys/fs/cgroup/memory.max")
  const v2used = readFile("/sys/fs/cgroup/memory.current")
  // A cgroup without its own limit is bounded by the machine: fall back to MemTotal rather than "unknown".
  if (v2used !== null) return { source: "cgroup2", limitBytes: limitOf(v2limit) ?? total, usedBytes: Number(v2used) || null }
  const v1used = readFile("/sys/fs/cgroup/memory/memory.usage_in_bytes")
  if (v1used !== null) {
    return {
      source: "cgroup1",
      limitBytes: limitOf(readFile("/sys/fs/cgroup/memory/memory.limit_in_bytes")) ?? total,
      usedBytes: Number(v1used) || null,
    }
  }
  const meminfo = readFile("/proc/meminfo")
  if (meminfo !== null) {
    const total = parseMeminfo(meminfo, "MemTotal")
    const available = parseMeminfo(meminfo, "MemAvailable")
    return { source: "meminfo", limitBytes: total, usedBytes: total !== null && available !== null ? total - available : null }
  }
  return { source: "none", limitBytes: null, usedBytes: null }
}

export const gb = (bytes) => (bytes === null || bytes === undefined ? "?" : `${(bytes / GB).toFixed(2)} GB`)

/** One line describing the machine, printed when the build starts. */
export function describeMachine(memory = readMemory(), cpuCount = cpus().length) {
  return `[build] machine: ${cpuCount} vCPU, memory limit ${gb(memory.limitBytes)} (${memory.source}), in use at start ${gb(memory.usedBytes)}`
}

/**
 * The exit code and the one line to print when the build process ends. A signal is never turned into a silent exit 1:
 * SIGKILL gets 137 (128 + 9, the shell convention) and says it is most likely the out-of-memory killer, with the peak.
 * @param {{ code: number | null, signal: string | null, peakBytes: number | null, limitBytes: number | null, seconds: number }} r
 * @returns {{ exitCode: number, line: string }}
 */
export function describeExit({ code, signal, peakBytes, limitBytes, seconds }) {
  const mem = `peak memory in use ${gb(peakBytes)} of ${gb(limitBytes)}`
  const ratio = peakBytes && limitBytes ? peakBytes / limitBytes : null
  if (signal) {
    const n = { SIGKILL: 9, SIGTERM: 15, SIGINT: 2, SIGSEGV: 11, SIGABRT: 6 }[signal] ?? 1
    const likelyOom = signal === "SIGKILL"
    return {
      exitCode: 128 + n,
      line:
        `✗ [build] next build was KILLED by ${signal} after ${seconds}s — ${mem}` +
        (likelyOom
          ? `. Most likely the out-of-memory killer${ratio !== null && ratio >= 0.85 ? " (memory was at the limit)" : ""}: this build needs a machine with more memory (Vercel: Enhanced 16 GB), set VERCEL_BUILD_SYSTEM_REPORT=1 for Vercel's own report.`
          : "."),
    }
  }
  return {
    exitCode: code ?? 1,
    line: code === 0 ? `[build] next build finished in ${seconds}s — ${mem}` : `✗ [build] next build exited ${code} after ${seconds}s — ${mem}`,
  }
}

/** Samples the memory in use every `everyMs` and keeps the peak. Never throws; unref'd (never keeps the process alive). */
export function startMemorySampler(everyMs = 2000, readNow = () => readMemory().usedBytes) {
  let peak = readNow()
  const timer = setInterval(() => {
    const used = readNow()
    if (used !== null && (peak === null || used > peak)) peak = used
  }, everyMs)
  timer.unref?.()
  return {
    stop() {
      clearInterval(timer)
      const used = readNow()
      if (used !== null && (peak === null || used > peak)) peak = used
      return peak
    },
  }
}
