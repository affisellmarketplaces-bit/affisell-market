#!/usr/bin/env tsx
/**
 * Seed World Radar — bootstrap (RSK-90, lot A).
 *
 * This file has NO static import, on purpose. In an ES module the static imports of a file are evaluated before its body, so a
 * snapshot taken in the body would come after whatever those imports did to `process.env` or to the env files. Instead:
 *   1. import the leaf module that takes the snapshot (it imports nothing),
 *   2. take the snapshot of the environment, `process.execArgv`, NODE_OPTIONS and the arguments — once, right now,
 *   3. only then import the program (`./radar-seed-run`), which reads that frozen snapshot and never `process.env`.
 * The program is imported ONLY here (a structural test enforces it). The previous version of this file loaded three env files with
 * `override: true` in its body, resolved the target with its own rules and built the client itself: all of that is gone.
 *
 * Usage:
 *   npm run radar:seed:world                          every class of target is DISABLED in this version: expect exit 3
 *   npm run radar:seed:world -- --countries=FR,DE,US  an invalid or unknown country is REFUSED (no fallback to all countries)
 *   npm run radar:seed:prod                           = --expect-class production (disabled in this version)
 *
 * Exit codes: 0 verified (unreachable in this version) · 1 configuration / unexpected · 2 refused · 3 target not proven or class
 * disabled · 4 seed failed (see state) · 5 verification failed (later) · 6 executed, NOT verified · 130 interrupted at the prompt.
 * The last output line is `[seed-world-radar] result=<key> exit=<n> state=<state>`; only `state=refused` proves that nothing was
 * written. No such line (a signal such as SIGKILL, a crash, an out-of-memory kill) means INDETERMINATE.
 *
 * The `exit` listener below is a best-effort backstop, not a guarantee: it runs when the process leaves through JavaScript
 * (normal end, `process.exit`, an uncaught exception or rejection, SIGINT / SIGTERM under the `tsx` CLI, which exits with 130 / 143),
 * and it does NOT run on SIGKILL, SIGHUP, an out-of-memory kill, a native crash or `process.abort()`. It is synchronous by necessity
 * and cannot know the phase, so it never claims `refused`: only `indeterminate`.
 */
export {}

// First statement, before any import: the listener must exist whatever fails later.
let reported = false
process.on("exit", (code) => {
  try {
    if (reported) return
    console.error(`[seed-world-radar] result=exited_without_report exit=${code} state=indeterminate`)
    // A run that ends with code 0 and no verdict is not a success. The literal is pinned to EXIT.SEED_FAILED by a test.
    if (code === 0) process.exitCode = 4
  } catch {
    // An exit listener must never throw: a throwing listener changes the exit code.
  }
})

let started = false

async function bootstrap(): Promise<number> {
  const { captureEntrySnapshot } = await import("./lib/radar-entry-snapshot.mjs")
  captureEntrySnapshot()
  const { runRadarSeedCli } = await import("./radar-seed-run")
  started = true
  return runRadarSeedCli()
}

bootstrap().then(
  (code) => {
    // The exit code is set, not forced: pending output is flushed. A handle that would keep the process alive is cut after 2 s.
    reported = true
    process.exitCode = code
    setTimeout(() => process.exit(code), 2000).unref()
  },
  (err: unknown) => {
    reported = true
    console.error(`[seed-world-radar] bootstrap failed (${err instanceof Error ? err.name : "unknown"})`)
    if (started) {
      console.error("[seed-world-radar] result=bootstrap_failed exit=4 state=indeterminate")
      process.exitCode = 4
    } else {
      console.error("[seed-world-radar] result=bootstrap_failed exit=1 state=refused")
      process.exitCode = 1
    }
  }
)
