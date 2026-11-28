import { describe, expect, it } from "vitest"

import { runAndReport } from "../../scripts/build-isolated.mjs"
import { describeExit, parseMeminfo, readMemory } from "../../scripts/lib/build-diagnostics.mjs"

const GB = 1024 ** 3

describe("build diagnostics — a stopped build says why", () => {
  it("SIGKILL is exit 137 and names the out-of-memory killer, with the peak against the limit", () => {
    const r = describeExit({ code: null, signal: "SIGKILL", peakBytes: 7.9 * GB, limitBytes: 8 * GB, seconds: 172 })
    expect(r.exitCode).toBe(137)
    expect(r.line).toMatch(/KILLED by SIGKILL after 172s/)
    expect(r.line).toMatch(/7\.90 GB of 8\.00 GB/)
    expect(r.line).toMatch(/out-of-memory killer \(memory was at the limit\)/)
    expect(r.line).toMatch(/VERCEL_BUILD_SYSTEM_REPORT=1/)
  })

  it("other signals keep 128+n and do not claim OOM; normal exits keep their code", () => {
    const term = describeExit({ code: null, signal: "SIGTERM", peakBytes: null, limitBytes: null, seconds: 3 })
    expect(term.exitCode).toBe(143)
    expect(term.line).not.toMatch(/out-of-memory/)
    expect(describeExit({ code: 0, signal: null, peakBytes: 1, limitBytes: 2, seconds: 9 }).exitCode).toBe(0)
    expect(describeExit({ code: 2, signal: null, peakBytes: null, limitBytes: null, seconds: 1 })).toMatchObject({
      exitCode: 2,
      line: expect.stringMatching(/exited 2/),
    })
  })

  it("memory source: cgroup v2, then v1 (no-limit sentinel ignored), then /proc/meminfo", () => {
    const fs2: Record<string, string> = { "/sys/fs/cgroup/memory.max": String(8 * GB), "/sys/fs/cgroup/memory.current": String(GB) }
    expect(readMemory((p) => fs2[p] ?? null)).toEqual({ source: "cgroup2", limitBytes: 8 * GB, usedBytes: GB })
    expect(readMemory((p) => ({ "/sys/fs/cgroup/memory.max": "max", "/sys/fs/cgroup/memory.current": "5" })[p] ?? null).limitBytes).toBeNull()
    // no cgroup limit → bounded by the machine's MemTotal
    const withMem = (p: string) =>
      ({ "/sys/fs/cgroup/memory.max": "max", "/sys/fs/cgroup/memory.current": "5", "/proc/meminfo": "MemTotal: 8000000 kB\n" })[p] ?? null
    expect(readMemory(withMem).limitBytes).toBe(8000000 * 1024)
    const fs1: Record<string, string> = {
      "/sys/fs/cgroup/memory/memory.usage_in_bytes": "100",
      "/sys/fs/cgroup/memory/memory.limit_in_bytes": "9223372036854771712",
    }
    expect(readMemory((p) => fs1[p] ?? null)).toEqual({ source: "cgroup1", limitBytes: null, usedBytes: 100 })
    const mi = "MemTotal:        8000000 kB\nMemFree:  1 kB\nMemAvailable:    2000000 kB\n"
    expect(parseMeminfo(mi, "MemTotal")).toBe(8000000 * 1024)
    expect(readMemory((p) => (p === "/proc/meminfo" ? mi : null))).toEqual({
      source: "meminfo",
      limitBytes: 8000000 * 1024,
      usedBytes: 6000000 * 1024,
    })
    expect(readMemory(() => null)).toEqual({ source: "none", limitBytes: null, usedBytes: null })
  })

  it("the REAL wrapper: a child killed by SIGKILL ends as 137 with the explicit line, not a bare exit 1", async () => {
    const out: string[] = []
    const code = await runAndReport(
      process.execPath,
      ["-e", "process.kill(process.pid, 'SIGKILL')"],
      { stdio: "ignore" },
      (l: string) => void out.push(l),
      (l: string) => void out.push(l),
    )
    expect(code).toBe(137)
    expect(out[0]).toMatch(/\[build\] machine: \d+ vCPU/)
    expect(out.at(-1)).toMatch(/KILLED by SIGKILL/)
  })

  it("the REAL wrapper: a normal exit keeps its code", async () => {
    const out: string[] = []
    expect(await runAndReport(process.execPath, ["-e", "process.exit(3)"], { stdio: "ignore" }, (l: string) => void out.push(l), (l: string) => void out.push(l))).toBe(3)
    expect(out.at(-1)).toMatch(/exited 3/)
  })
})
