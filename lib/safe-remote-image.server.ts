import "server-only"

import * as dns from "node:dns"
import * as http from "node:http"
import * as https from "node:https"
import * as net from "node:net"

import { assertSafeOutboundUrl } from "@/lib/safe-outbound-url"

/**
 * Download an image a USER chose the URL of (a listing's custom image, a pasted link…) without letting the
 * server be used as a proxy into its own network.
 *
 * `assertSafeOutboundUrl` only reads the hostname text, so a public name that resolves to 127.0.0.1 or to a cloud
 * metadata address, an IPv6 private literal, or a redirect to an internal host all got through. Here the address is
 * checked at CONNECTION time (the resolver answer is the address that is dialled, so DNS rebinding cannot swap it),
 * every redirect hop is revalidated, and the body is bounded in size and time.
 */

export type RemoteImageErrorCode =
  | "blocked_host"
  | "blocked_address"
  | "too_large"
  | "timeout"
  | "too_many_redirects"
  | "bad_status"
  | "invalid_url"
  | "network"

export class RemoteImageError extends Error {
  readonly code: RemoteImageErrorCode
  constructor(code: RemoteImageErrorCode, detail?: string) {
    super(detail ? `remote_image_${code}: ${detail}` : `remote_image_${code}`)
    this.name = "RemoteImageError"
    this.code = code
  }
}

function parseIpv4(ip: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return null
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] as [number, number, number, number]
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null
}

function isPrivateIpv4(parts: readonly number[]): boolean {
  const [a = 0, b = 0, c = 0] = parts
  if (a === 0 || a === 10 || a === 127) return true // "this" network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 169 && b === 254) return true // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true // IETF protocol, TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a === 198 && b === 51 && c === 100) return true // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true // TEST-NET-3
  if (a >= 224) return true // multicast, reserved, broadcast
  return false
}

/** Eight 16-bit groups of an IPv6 address, or null when it is not a valid one. */
function parseIpv6(raw: string): number[] | null {
  let text = raw
  if (text.includes("%")) return null // zone ids only exist on link-local addresses: refuse
  const lastColon = text.lastIndexOf(":")
  const tail = text.slice(lastColon + 1)
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail)
    if (!v4) return null
    text = `${text.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`
  }
  const halves = text.split("::")
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(":") : []
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : []
  const missing = 8 - head.length - rest.length
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest]
  if (groups.length !== 8) return null
  const out = groups.map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? parseInt(g, 16) : Number.NaN))
  return out.some(Number.isNaN) ? null : out
}

function isPrivateIpv6(g: number[]): boolean {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [number, number, number, number, number, number, number, number]
  const embedded = (hi: number, lo: number) => isPrivateIpv4([hi >> 8, hi & 255, lo >> 8, lo & 255])

  const firstFiveZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0

  if (firstFiveZero && g5 === 0) return true // ::/96 — unspecified, loopback, deprecated IPv4-compatible
  if (firstFiveZero && g5 === 0xffff) return embedded(g6, g7) // ::ffff:a.b.c.d (IPv4-mapped)
  if ((g0 & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((g0 & 0xffc0) === 0xfec0) return true // fec0::/10 site-local (deprecated)
  if ((g0 & 0xff00) === 0xff00) return true // ff00::/8 multicast
  if (g0 === 0x64 && g1 === 0xff9b) {
    // 64:ff9b::/96 (NAT64) embeds an IPv4 address; the rest of 64:ff9b::/16 is local-use
    return g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 ? embedded(g6, g7) : true
  }
  if (g0 === 0x2002) return embedded(g1, g2) // 6to4 embeds the IPv4 address
  if (g0 === 0x2001 && g1 === 0) return true // Teredo
  if (g0 === 0x2001 && g1 === 0xdb8) return true // documentation
  return false
}

/**
 * True when a server must never connect to this address. FAILS CLOSED: anything that is not a well-formed IPv4 or
 * IPv6 literal counts as blocked.
 */
export function isPrivateAddress(address: string): boolean {
  const text = address.trim().replace(/^\[|\]$/g, "")
  const v4 = parseIpv4(text)
  if (v4) return isPrivateIpv4(v4)
  if (net.isIPv6(text)) {
    const groups = parseIpv6(text)
    return groups ? isPrivateIpv6(groups) : true
  }
  return true
}

type Resolver = (
  hostname: string,
  options: dns.LookupAllOptions,
  callback: (error: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void
) => void

/**
 * A `lookup` for `http(s).request` that refuses to hand back any private address. If a name resolves to SEVERAL
 * addresses and one of them is private, the whole name is refused (no picking the "good" one for the check and a
 * different one to dial).
 */
export function createPublicLookup(
  isBlocked: (address: string) => boolean = isPrivateAddress,
  resolve: Resolver = dns.lookup as unknown as Resolver
): net.LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) return callback(error, "", 0)
      if (!addresses?.length) return callback(new RemoteImageError("network", "no_address"), "", 0)
      const blocked = addresses.find((a) => isBlocked(a.address))
      if (blocked) return callback(new RemoteImageError("blocked_address", blocked.address), "", 0)
      if (options.all) return callback(null, addresses)
      return callback(null, addresses[0]!.address, addresses[0]!.family)
    })
  }
}

export type FetchPublicImageOptions = {
  /** Body bigger than this is refused while streaming. Default 8 MiB. */
  maxBytes?: number
  /** One deadline for the whole download, redirects included. Default 8 s. */
  timeoutMs?: number
  /** Default 3. Each hop is validated like the first request. */
  maxRedirects?: number
  /** Default true (listing images stored as http:// keep working; the host checks do not depend on the scheme). */
  allowHttp?: boolean
  /** Test seams — production code uses the defaults. */
  resolver?: Resolver
  isBlockedAddress?: (address: string) => boolean
}

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_MAX_REDIRECTS = 3

function requestOnce(url: URL, lookup: net.LookupFunction, signal: AbortSignal): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "http:" ? http : https
    const req = transport.request(
      url,
      {
        method: "GET",
        lookup,
        signal,
        agent: false,
        headers: { Accept: "image/*", "Accept-Encoding": "identity", "User-Agent": "AffisellImageFetch/1.0" },
      },
      resolve
    )
    req.once("error", reject)
    req.end()
  })
}

async function readBounded(res: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers["content-length"])
  if (Number.isFinite(declared) && declared > maxBytes) {
    res.destroy()
    throw new RemoteImageError("too_large", `content-length ${declared}`)
  }
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of res) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    total += buf.length
    if (total > maxBytes) {
      res.destroy()
      throw new RemoteImageError("too_large", `over ${maxBytes} bytes`)
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks, total)
}

function asRemoteImageError(error: unknown, signal: AbortSignal): RemoteImageError {
  if (error instanceof RemoteImageError) return error
  if (signal.aborted) return new RemoteImageError("timeout")
  const cause = (error as { cause?: unknown } | null)?.cause
  if (cause instanceof RemoteImageError) return cause
  return new RemoteImageError("network", error instanceof Error ? error.message : String(error))
}

/**
 * Fetches `rawUrl` and returns its bytes. Throws a `RemoteImageError` for anything that is not a plain, public,
 * reasonably small image download. It does not look at the content: callers still sniff the format.
 */
export async function fetchPublicImageBytes(
  rawUrl: string,
  options: FetchPublicImageOptions = {}
): Promise<Buffer> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  const isBlocked = options.isBlockedAddress ?? isPrivateAddress
  const lookup = createPublicLookup(isBlocked, options.resolver)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    let current = rawUrl
    for (let hop = 0; ; hop += 1) {
      const checked = assertSafeOutboundUrl(current, { allowHttp: options.allowHttp ?? true })
      if (!checked.ok) throw new RemoteImageError("blocked_host", checked.error)
      const url = checked.url

      // `net` never calls `lookup` for an IP literal, so a literal has to be judged here.
      const literal = url.hostname.replace(/^\[|\]$/g, "")
      if (net.isIP(literal) && isBlocked(literal)) throw new RemoteImageError("blocked_address", literal)

      let res: http.IncomingMessage
      try {
        res = await requestOnce(url, lookup, controller.signal)
      } catch (error) {
        throw asRemoteImageError(error, controller.signal)
      }

      const status = res.statusCode ?? 0
      const location = res.headers.location
      if (status >= 300 && status < 400 && location) {
        res.resume()
        if (hop >= maxRedirects) throw new RemoteImageError("too_many_redirects")
        try {
          current = new URL(location, url).toString()
        } catch {
          throw new RemoteImageError("invalid_url", "redirect location")
        }
        continue
      }
      if (status !== 200) {
        res.destroy()
        throw new RemoteImageError("bad_status", String(status))
      }

      try {
        return await readBounded(res, maxBytes)
      } catch (error) {
        throw asRemoteImageError(error, controller.signal)
      }
    }
  } finally {
    clearTimeout(timer)
  }
}
