import * as http from "node:http"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import {
  createPublicLookup,
  fetchPublicImageBytes,
  isPrivateAddress,
  RemoteImageError,
  type FetchPublicImageOptions,
} from "@/lib/safe-remote-image.server"

type Resolver = NonNullable<FetchPublicImageOptions["resolver"]>

function resolverTo(...addresses: string[]): Resolver {
  return (_host, _options, callback) =>
    callback(
      null,
      addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }))
    )
}

describe("isPrivateAddress", () => {
  const blocked = [
    // IPv4
    "127.0.0.1", "127.255.255.254", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.1.1",
    "169.254.169.254", "100.64.0.1", "100.127.255.255", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    "192.0.2.1", "203.0.113.9", "198.51.100.7",
    // IPv6
    "::", "::1", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "fec0::1", "2001:db8::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:a9fe:a9fe", "::127.0.0.1",
    "64:ff9b::7f00:1", "64:ff9b:1::1", "2002:7f00:1::", "2002:a9fe:a9fe::1",
    "2001:0:4136:e378:8000:63bf:3fff:fdd2",
    "[::1]",
    // not an address at all: fail closed
    "", "example.com", "999.1.1.1", "1.2.3", "fe80::1%eth0", "::gggg",
  ]
  const allowed = [
    "8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.255.255", "172.32.0.1", "100.63.255.255", "100.128.0.1", "198.20.0.1",
    "2001:4860:4860::8888", "2606:4700:4700::1111", "::ffff:8.8.8.8", "2002:808:808::1", "64:ff9b::808:808",
  ]

  for (const address of blocked) {
    it(`blocks ${JSON.stringify(address)}`, () => expect(isPrivateAddress(address)).toBe(true))
  }
  for (const address of allowed) {
    it(`allows ${address}`, () => expect(isPrivateAddress(address)).toBe(false))
  }
})

describe("createPublicLookup", () => {
  function run(resolver: Resolver, options: { all?: boolean } = {}) {
    return new Promise<{ error: unknown; address: unknown; family: unknown }>((resolve) => {
      createPublicLookup(undefined, resolver)("img.example.test", options, (error, address, family) =>
        resolve({ error, address, family })
      )
    })
  }

  it("refuses a public name that resolves to a private address (DNS pointing inside)", async () => {
    const { error } = await run(resolverTo("169.254.169.254"))
    expect(error).toBeInstanceOf(RemoteImageError)
    expect((error as RemoteImageError).code).toBe("blocked_address")
  })

  it("refuses the whole name when ANY answer is private", async () => {
    const { error } = await run(resolverTo("8.8.8.8", "10.0.0.5"), { all: true })
    expect((error as RemoteImageError).code).toBe("blocked_address")
  })

  it("hands back a single public address when asked for one", async () => {
    expect(await run(resolverTo("8.8.8.8"))).toEqual({ error: null, address: "8.8.8.8", family: 4 })
  })

  it("hands back the list when asked for all (autoSelectFamily)", async () => {
    const result = await run(resolverTo("8.8.8.8", "2606:4700:4700::1111"), { all: true })
    expect(result.error).toBeNull()
    expect(result.address).toEqual([
      { address: "8.8.8.8", family: 4 },
      { address: "2606:4700:4700::1111", family: 6 },
    ])
  })

  it("passes a resolver error through", async () => {
    const failing: Resolver = (_h, _o, callback) => callback(new Error("ENOTFOUND") as NodeJS.ErrnoException, [])
    expect(((await run(failing)).error as Error).message).toBe("ENOTFOUND")
  })
})

describe("fetchPublicImageBytes — refusals that never open a connection", () => {
  it("refuses a name whose DNS answer is a cloud metadata address", async () => {
    const resolver = vi.fn(resolverTo("169.254.169.254"))
    await expect(fetchPublicImageBytes("https://rebind.example.test/a.png", { resolver })).rejects.toMatchObject({
      code: "blocked_address",
    })
    expect(resolver).toHaveBeenCalledTimes(1)
  })

  const literals: Array<[string, string]> = [
    ["http://127.0.0.1/a.png", "blocked_host"],
    ["http://localhost/a.png", "blocked_host"],
    ["http://169.254.169.254/latest/meta-data/", "blocked_host"],
    ["https://[::ffff:127.0.0.1]/a.png", "blocked_address"],
    ["https://[fd00::1]/a.png", "blocked_address"],
    ["https://user:pass@img.example.test/a.png", "blocked_host"],
    ["ftp://img.example.test/a.png", "blocked_host"],
    ["not a url", "blocked_host"],
  ]
  for (const [url, code] of literals) {
    it(`refuses ${url}`, async () => {
      await expect(fetchPublicImageBytes(url)).rejects.toMatchObject({ code })
    })
  }

  it("refuses http:// when it is not allowed", async () => {
    await expect(fetchPublicImageBytes("http://img.example.test/a.png", { allowHttp: false })).rejects.toMatchObject({
      code: "blocked_host",
    })
  })
})

describe("fetchPublicImageBytes — against a local server", () => {
  const hits: string[] = []
  let server: http.Server
  let base: string

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const path = req.url ?? ""
      hits.push(path)
      if (path === "/ok") {
        const body = Buffer.from("hello-image-bytes")
        res.writeHead(200, { "Content-Length": body.length })
        res.end(body)
      } else if (path === "/redirect") {
        res.writeHead(302, { Location: "/ok" })
        res.end()
      } else if (path.startsWith("/hop/")) {
        const n = Number(path.slice(5))
        res.writeHead(302, { Location: n > 0 ? `/hop/${n - 1}` : "/ok" })
        res.end()
      } else if (path === "/to-internal") {
        res.writeHead(302, { Location: `http://localhost:${(server.address() as AddressInfo).port}/secret` })
        res.end()
      } else if (path === "/declared-big") {
        res.writeHead(200, { "Content-Length": 100 })
        res.end(Buffer.alloc(100))
      } else if (path === "/chunked-big") {
        res.writeHead(200)
        res.write(Buffer.alloc(8))
        setTimeout(() => res.end(Buffer.alloc(8)), 20)
      } else if (path === "/missing") {
        res.writeHead(404)
        res.end()
      } else if (path === "/slow") {
        // never answers
      } else {
        res.writeHead(200)
        res.end("secret")
      }
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    base = `http://img.example.test:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  // the test name resolves to the local server and the private-address rule is lifted ONLY for this suite
  const local: FetchPublicImageOptions = { resolver: resolverTo("127.0.0.1"), isBlockedAddress: () => false }

  it("downloads a plain image", async () => {
    expect((await fetchPublicImageBytes(`${base}/ok`, local)).toString()).toBe("hello-image-bytes")
  })

  it("follows a redirect", async () => {
    expect((await fetchPublicImageBytes(`${base}/redirect`, local)).toString()).toBe("hello-image-bytes")
  })

  it("follows 3 redirects and no more (the default limit)", async () => {
    // /hop/2 -> /hop/1 -> /hop/0 -> /ok is three redirects; /hop/3 is four
    expect((await fetchPublicImageBytes(`${base}/hop/2`, local)).toString()).toBe("hello-image-bytes")
    await expect(fetchPublicImageBytes(`${base}/hop/3`, local)).rejects.toMatchObject({ code: "too_many_redirects" })
  })

  it("revalidates a redirect target: a hop to localhost is refused and never requested", async () => {
    await expect(fetchPublicImageBytes(`${base}/to-internal`, local)).rejects.toMatchObject({ code: "blocked_host" })
    expect(hits).not.toContain("/secret")
  })

  it("refuses a body whose declared size is over the limit", async () => {
    await expect(fetchPublicImageBytes(`${base}/declared-big`, { ...local, maxBytes: 10 })).rejects.toMatchObject({
      code: "too_large",
    })
  })

  it("refuses a body that grows past the limit while streaming (no Content-Length)", async () => {
    await expect(fetchPublicImageBytes(`${base}/chunked-big`, { ...local, maxBytes: 10 })).rejects.toMatchObject({
      code: "too_large",
    })
  })

  it("gives up on a server that never answers", async () => {
    await expect(fetchPublicImageBytes(`${base}/slow`, { ...local, timeoutMs: 150 })).rejects.toMatchObject({
      code: "timeout",
    })
  })

  it("refuses a non-200 answer", async () => {
    await expect(fetchPublicImageBytes(`${base}/missing`, local)).rejects.toMatchObject({ code: "bad_status" })
  })
})
