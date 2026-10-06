import { EventEmitter } from "node:events"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  classifyTlsFailure,
  describeUnreachable,
  probeHostTls,
  shouldProbeStoreSubdomains,
  subdomainProbeHost,
} from "@/lib/store-subdomain-reachability"

describe("classifyTlsFailure", () => {
  it.each([
    // The exact code Node reports for the real production failure (Cloudflare has no certificate for a 2-level host).
    ["ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE", "tls_handshake_failed"],
    ["ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE", "tls_handshake_failed"],
    ["ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR", "tls_handshake_failed"],
    ["ERR_SSL_TLSV1_UNRECOGNIZED_NAME", "tls_handshake_failed"],
    ["ERR_SSL_WRONG_VERSION_NUMBER", "tls_protocol_error"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "tls_certificate_mismatch"],
    ["CERT_HAS_EXPIRED", "tls_certificate_mismatch"],
    ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "tls_certificate_mismatch"],
    ["ENOTFOUND", "dns_not_found"],
  ])("%s is a definitive failure (%s)", (code, reason) => {
    expect(classifyTlsFailure(code)).toEqual({ state: "unreachable", reason, code })
  })

  it.each(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "EHOSTUNREACH", "PROBE_TIMEOUT", "SOMETHING_ELSE"])(
    "%s says nothing about the certificate — inconclusive, never a reason to demote",
    (code) => {
      expect(classifyTlsFailure(code).state).toBe("inconclusive")
    }
  )

  it("an error without a code is inconclusive", () => {
    expect(classifyTlsFailure(undefined).state).toBe("inconclusive")
    expect(classifyTlsFailure(null).state).toBe("inconclusive")
  })
})

type FakeSocket = EventEmitter & { authorized: boolean; destroy: () => void; destroyed?: boolean }
function fakeSocket(): FakeSocket {
  const s = new EventEmitter() as FakeSocket
  s.authorized = true
  s.destroy = () => {
    s.destroyed = true
  }
  return s
}

describe("probeHostTls", () => {
  it("connects with SNI = host and full verification, and reports reachable on secureConnect", async () => {
    const socket = fakeSocket()
    const connect = vi.fn(() => {
      queueMicrotask(() => socket.emit("secureConnect"))
      return socket
    })
    const result = await probeHostTls("shop.example.com", { connect: connect as never })
    expect(result).toEqual({ state: "reachable" })
    expect(connect).toHaveBeenCalledWith({ host: "shop.example.com", port: 443, servername: "shop.example.com", rejectUnauthorized: true })
    expect(socket.destroyed).toBe(true)
  })

  it("an unauthorized certificate is never reported reachable", async () => {
    const socket = fakeSocket()
    socket.authorized = false
    const result = await probeHostTls("x.example.com", {
      connect: (() => {
        queueMicrotask(() => socket.emit("secureConnect"))
        return socket
      }) as never,
    })
    expect(result.state).toBe("unreachable")
  })

  it("classifies a TLS error from the socket", async () => {
    const socket = fakeSocket()
    const result = await probeHostTls("x.example.com", {
      connect: (() => {
        queueMicrotask(() => socket.emit("error", Object.assign(new Error("handshake failure"), { code: "ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE" })))
        return socket
      }) as never,
    })
    expect(result).toMatchObject({ state: "unreachable", reason: "tls_handshake_failed" })
    expect(socket.destroyed).toBe(true)
  })

  it("times out as inconclusive rather than hanging or demoting", async () => {
    const socket = fakeSocket()
    const result = await probeHostTls("x.example.com", { timeoutMs: 20, connect: (() => socket) as never })
    expect(result).toEqual({ state: "inconclusive", code: "PROBE_TIMEOUT" })
    expect(socket.destroyed).toBe(true)
  })

  it("a synchronous connect failure is classified, not thrown", async () => {
    const result = await probeHostTls("x.example.com", {
      connect: (() => {
        throw Object.assign(new Error("bad"), { code: "ERR_SSL_WRONG_VERSION_NUMBER" })
      }) as never,
    })
    expect(result).toMatchObject({ state: "unreachable", reason: "tls_protocol_error" })
  })

  it("settles once: a late event after the verdict changes nothing", async () => {
    const socket = fakeSocket()
    const result = await probeHostTls("x.example.com", {
      connect: (() => {
        queueMicrotask(() => {
          socket.emit("secureConnect")
          socket.emit("error", Object.assign(new Error("late"), { code: "ECONNRESET" }))
        })
        return socket
      }) as never,
    })
    expect(result).toEqual({ state: "reachable" })
  })
})

describe("probe configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("the sentinel host sits under the same wildcard as every store", () => {
    vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.affisell.com")
    expect(subdomainProbeHost()).toBe("tls-check.shops.affisell.com")
  })

  it("probes in production, not in dev/preview, and obeys the explicit switch", () => {
    vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.affisell.com")
    vi.stubEnv("NODE_ENV", "production")
    expect(shouldProbeStoreSubdomains()).toBe(true)
    vi.stubEnv("NODE_ENV", "development")
    expect(shouldProbeStoreSubdomains()).toBe(false)
    vi.stubEnv("AFFISELL_SUBDOMAIN_PROBE", "1")
    expect(shouldProbeStoreSubdomains()).toBe(true)
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AFFISELL_SUBDOMAIN_PROBE", "0")
    expect(shouldProbeStoreSubdomains()).toBe(false)
  })

  it("never probes a .localhost suffix", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AFFISELL_STORE_HOST_SUFFIX", "shops.localhost")
    expect(shouldProbeStoreSubdomains()).toBe(false)
  })

  it("explains the failure in plain words, naming the real cause", () => {
    const text = describeUnreachable({ state: "unreachable", reason: "tls_handshake_failed", code: "X" })
    expect(text).toMatch(/Cloudflare/)
    expect(text).toMatch(/two-level/)
  })
})
