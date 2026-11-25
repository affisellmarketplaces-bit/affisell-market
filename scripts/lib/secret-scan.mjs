/**
 * Secret patterns for scripts/verify-no-secrets.mjs (pre-push and CI). Pure: no file system, no process.
 *
 * Three kinds of findings, none of which ever prints the matched value in full:
 *  - provider keys by shape (Stripe, OpenAI, Groq, GitHub, AWS, PEM, Medusa secret API key);
 *  - credentials written as code (a `medusa user … -p <literal>` command, a *PASSWORD variable assigned a literal);
 *  - values known to be compromised, matched by SHA-256 of every token (the value itself is never in the repository).
 */
import { createHash } from "node:crypto"

import { COMPROMISED_SHA256 } from "./compromised-credentials.mjs"

export const PATTERNS = [
  { name: "Groq API key", re: /\bgsk_[A-Za-z0-9]{20,}\b/ },
  { name: "OpenAI API key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "Stripe live secret key", re: /\bsk_live_[A-Za-z0-9]{10,}\b/ },
  { name: "Stripe live restricted key", re: /\brk_live_[A-Za-z0-9]{10,}\b/ },
  { name: "Stripe test secret key", re: /\bsk_test_[A-Za-z0-9]{10,}\b/ },
  { name: "Stripe webhook secret", re: /\bwhsec_[A-Za-z0-9]{20,}\b/ },
  { name: "Medusa secret API key", re: /\bsk_[0-9a-f]{64}\b/ },
  { name: "GitHub PAT", re: /\b(?:ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key PEM", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Medusa CLI password literal", re: /\buser\s+-e\s+\S+\s+-p\s+[^\s$"'{}]+/ },
  {
    name: "Password assigned a literal",
    // A *PASSWORD name assigned (= or :) a quoted literal of 6+ characters. An env lookup, an empty string or a
    // ${…} template is fine.
    re: /\b[A-Z_]*PASSWORD\s*[:=]\s*["'][^"'\s$]{6,}["']/,
  },
]

/** Tokens a password could be: runs of printable characters between quotes, spaces and common separators. */
const TOKEN_RE = /[^\s"'`=,:;(){}[\]<>]{8,128}/g

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex")
}

/**
 * @param {string} text
 * @param {{ denylist?: Set<string> }} [options] SHA-256 hex digests of compromised values (default: the repository's list)
 * @returns {Array<{ kind: string, sample: string }>} at most one finding per kind; `sample` is masked
 */
export function scanText(text, { denylist = COMPROMISED_SHA256 } = {}) {
  const findings = []
  for (const { name, re } of PATTERNS) {
    const m = text.match(re)
    if (m) findings.push({ kind: name, sample: `${m[0].slice(0, 8)}…` })
  }
  if (denylist.size > 0) {
    for (const token of text.match(TOKEN_RE) ?? []) {
      if (denylist.has(sha256Hex(token))) {
        findings.push({ kind: "Known compromised credential", sample: "(value withheld)" })
        break
      }
    }
  }
  return findings
}
