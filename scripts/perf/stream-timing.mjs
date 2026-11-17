#!/usr/bin/env node
/**
 * Measurement helper: when does the browser get each part of a streamed page? Prints time to first byte, to the hero
 * markup, to the first resolved Suspense boundary (React's `<div hidden id="S:…">`), and to the last byte. Read-only GET.
 * Usage: node scripts/perf/stream-timing.mjs <url> <label> [heroMarker]
 */
const [url, label = url, heroMarker = 'data-testid="buyer-premium-hero"'] = process.argv.slice(2)
const t0 = performance.now()
const res = await fetch(url, { headers: { "accept-language": "en" }, redirect: "manual" })
const reader = res.body.getReader()
const dec = new TextDecoder()
let html = ""
let ttfb = null
let hero = null
let boundary = null
for (;;) {
  const { done, value } = await reader.read()
  if (done) break
  const now = performance.now() - t0
  if (ttfb === null) ttfb = now
  html += dec.decode(value, { stream: true })
  if (hero === null && html.includes(heroMarker)) hero = now
  if (boundary === null && html.includes('<div hidden id="S:')) boundary = now
}
const end = performance.now() - t0
const f = (v) => (v === null ? "—" : `${Math.round(v)} ms`)
console.log(`[stream] ${label} · status ${res.status} · first byte ${f(ttfb)} · hero ${f(hero)} · first streamed boundary ${f(boundary)} · last byte ${f(end)} · ${Math.round(html.length / 1024)} KiB`)
