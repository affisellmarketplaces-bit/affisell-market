/**
 * Can a browser actually open `https://{host}`? — a real TLS handshake, not a configuration lookup.
 *
 * Why this exists: a store's auto subdomain was marked "active" as soon as VERCEL said the domain was configured. But
 * browsers never talk to Vercel first. Behind a proxy such as Cloudflare the TLS handshake ends at the proxy's edge, and its
 * free Universal certificate only covers ONE label under the apex (`*.affisell.com`) — not `{slug}.shops.affisell.com`.
 * The result was a store whose "main address" returned ERR_SSL_VERSION_OR_CIPHER_MISMATCH while the dashboard said "active".
 * Status must describe what a visitor experiences, so it is decided by this probe.
 *
 * Node-only (`node:tls`). Failures are classified so a status is never flipped on a hiccup:
 *   • "unreachable"  — definitive: the handshake was refused, or the certificate does not cover the host, or the name does not exist.
 *   • "inconclusive" — timeouts / resets / temporary DNS: says nothing about the certificate, so callers keep the previous state.
 */
import tls from "node:tls"

import { storeHostSuffix } from "@/lib/store-host-suffix"

export type SubdomainUnreachableReason =
  | "tls_handshake_failed"
  | "tls_certificate_mismatch"
  | "tls_protocol_error"
  | "dns_not_found"

export type SubdomainReachability =
  | { state: "reachable" }
  | { state: "unreachable"; reason: SubdomainUnreachableReason; code: string }
  | { state: "inconclusive"; code: string }

/** Label used to probe the wildcard without touching a real store's host. */
export const SUBDOMAIN_PROBE_LABEL = "tls-check"

/** `tls-check.shops.affisell.com` — covered by exactly the same certificate as any `{slug}.shops.affisell.com`. */
export function subdomainProbeHost(): string {
  return `${SUBDOMAIN_PROBE_LABEL}.${storeHostSuffix()}`
}

const CERT_MISMATCH_CODES = new Set(["ERR_TLS_CERT_ALTNAME_INVALID", "ERR_SSL_VERSION_OR_CIPHER_MISMATCH"])
const CERT_UNTRUSTED_CODES = new Set([
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "CERT_UNTRUSTED",
  "HOSTNAME_MISMATCH",
])
const HANDSHAKE_REFUSED = /HANDSHAKE_FAILURE|INTERNAL_ERROR|HANDSHAKE_FAILED|NO_SHARED_CIPHER|UNRECOGNIZED_NAME|ALERT_ACCESS_DENIED/
const INCONCLUSIVE_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "ECONNABORTED",
  "PROBE_TIMEOUT",
])

/** Maps a Node/OpenSSL error code to a verdict. Unknown codes are inconclusive on purpose: never demote on a guess. */
export function classifyTlsFailure(code: string | undefined | null): SubdomainReachability {
  const c = (code ?? "UNKNOWN").toUpperCase()
  if (c === "ENOTFOUND") return { state: "unreachable", reason: "dns_not_found", code: c }
  if (CERT_MISMATCH_CODES.has(c) || CERT_UNTRUSTED_CODES.has(c)) {
    return { state: "unreachable", reason: "tls_certificate_mismatch", code: c }
  }
  if (c.startsWith("ERR_SSL_") || c.startsWith("ERR_TLS_")) {
    return {
      state: "unreachable",
      reason: HANDSHAKE_REFUSED.test(c) ? "tls_handshake_failed" : "tls_protocol_error",
      code: c,
    }
  }
  if (INCONCLUSIVE_CODES.has(c)) return { state: "inconclusive", code: c }
  return { state: "inconclusive", code: c }
}

type ConnectFn = typeof tls.connect

/**
 * Opens a TLS connection to `host:443` with SNI = host and full certificate / hostname verification.
 * `connect` is injectable so the classification and the flow are unit-testable without a network.
 */
export function probeHostTls(
  host: string,
  options: { timeoutMs?: number; connect?: ConnectFn } = {}
): Promise<SubdomainReachability> {
  const { timeoutMs = 6_000, connect = tls.connect } = options

  return new Promise((resolve) => {
    let settled = false
    const done = (result: SubdomainReachability, socket?: { destroy: () => void }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        socket?.destroy()
      } catch {
        /* already closed */
      }
      resolve(result)
    }

    let socket: ReturnType<ConnectFn> | undefined
    const timer = setTimeout(() => done({ state: "inconclusive", code: "PROBE_TIMEOUT" }, socket), timeoutMs)

    try {
      socket = connect({ host, port: 443, servername: host, rejectUnauthorized: true })
    } catch (err) {
      return done(classifyTlsFailure((err as NodeJS.ErrnoException).code))
    }

    socket.once("secureConnect", () => {
      // rejectUnauthorized already guarantees chain + hostname; `authorized` is the explicit second check.
      done(socket!.authorized === false ? classifyTlsFailure("CERT_UNTRUSTED") : { state: "reachable" }, socket)
    })
    socket.once("error", (err: NodeJS.ErrnoException) => done(classifyTlsFailure(err.code), socket))
  })
}

/** Probing is meaningful only for real deployments: a dev machine or a preview URL has no wildcard hosts to reach. */
export function shouldProbeStoreSubdomains(): boolean {
  if (process.env.AFFISELL_SUBDOMAIN_PROBE === "0") return false
  if (process.env.AFFISELL_SUBDOMAIN_PROBE === "1") return true
  const suffix = storeHostSuffix()
  if (suffix === "localhost" || suffix.endsWith(".localhost")) return false
  return process.env.NODE_ENV === "production"
}

/** One-line, human-readable cause for logs and the admin diagnosis. */
export function describeUnreachable(result: Extract<SubdomainReachability, { state: "unreachable" }>): string {
  switch (result.reason) {
    case "tls_handshake_failed":
      return `TLS handshake refused (${result.code}): the edge has no certificate for this host. Behind Cloudflare this means its certificate does not cover a two-level subdomain.`
    case "tls_certificate_mismatch":
      return `The certificate served does not cover this host or is not trusted (${result.code}).`
    case "tls_protocol_error":
      return `TLS protocol error (${result.code}).`
    case "dns_not_found":
      return "The host name does not resolve (no wildcard DNS record)."
  }
}
