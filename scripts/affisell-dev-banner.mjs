/** Affisell dev URLs — terminal only (no external browser). */

export function printAffisellDevBanner(origin, { alreadyRunning = false, ready = false } = {}) {
  const head = ready
    ? `[affisell dev] Affisell — ready → ${origin}`
    : alreadyRunning
      ? `[affisell dev] Affisell — already running → ${origin}`
      : `[affisell dev] Affisell — starting → ${origin}`

  console.log(
    `\n${head}\n` +
      `  Home:      ${origin}/\n` +
      `  Dashboard: ${origin}/dashboard/supplier\n` +
      `  Radar:     ${origin}/radar\n`
  )
}

export function attachAffisellReadyBanner(child, origin) {
  let printed = false

  function onChunk(chunk) {
    if (printed) return
    const text = chunk.toString()
    if (/Ready in \d+/i.test(text) || /✓ Ready/i.test(text)) {
      printed = true
      printAffisellDevBanner(origin, { ready: true })
    }
  }

  child.stdout?.on("data", onChunk)
  child.stderr?.on("data", onChunk)
}
