import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { LISTING_MUTATION_REGISTRY } from "@/lib/listing-presence/mutation-registry"
import { LISTING_PRESENCE_SOURCES } from "@/lib/listing-presence/sources"
import { LISTING_PRICE_SOURCES } from "@/lib/listing-price-history/sources"
import { withdrawalReason } from "@/lib/reseller-copilot/temporal-opportunities"
import { scanFile, scanListingMutations, siteKeys, type MutationSite } from "@/lib/testing/listing-mutation-scan"

const KNOWN = [...new Set([...LISTING_PRESENCE_SOURCES, ...LISTING_PRICE_SOURCES])]
const sites = siteKeys(scanListingMutations(process.cwd(), KNOWN))
const presence = sites.filter((s) => s.effect === "presence")
const byKey = new Map(presence.map((s) => [s.key, s]))
const howToFix =
  "Déclarez la source de la mutation (withListingPresenceSource / declareListingPresenceSource, lib/listing-presence/declare.ts) " +
  "et ajoutez-la à LISTING_MUTATION_REGISTRY (lib/listing-presence/mutation-registry.ts)."

describe("the CI lock — every write that can change a listing's life is registered and attributed", () => {
  it("scans a real repository (sanity: the known paths are found)", () => {
    expect(presence.length).toBeGreaterThanOrEqual(40)
    expect(byKey.has("lib/affiliate-quick-add-listing.server.ts#quickAddAffiliateListing#create")).toBe(true)
  })

  it("no unregistered path: a new write is detected", () => {
    const registered = new Set(LISTING_MUTATION_REGISTRY.map((e) => e.key))
    const missing = presence.filter((s) => !registered.has(s.key)).map((s) => `${s.key} (ligne ${s.line}, ${s.effectReason})`)
    expect(missing, `Mutation(s) d'annonce non enregistrée(s). ${howToFix}`).toEqual([])
  })

  it("no stale entry: every registered path still exists", () => {
    const stale = LISTING_MUTATION_REGISTRY.filter((e) => !byKey.has(e.key)).map((e) => e.key)
    expect(stale, "Entrée(s) du registre sans écriture correspondante : retirez-les ou mettez la clé à jour.").toEqual([])
  })

  it("each registered path declares what the registry says, in its own transaction", () => {
    for (const e of LISTING_MUTATION_REGISTRY) {
      const s = byKey.get(e.key)
      if (!s) continue
      if (e.attribution === "wrapper") {
        expect(s.file, e.key).toBe("lib/listing-price-history/record.server.ts")
        continue
      }
      const kind = e.attribution === "declared" ? "declared" : "inherited_price_source"
      expect(s.attribution.kind, `${e.key}: attendu ${kind}`).toBe(kind)
      const found = s.attribution.kind === "none" ? [] : [...s.attribution.sources].sort()
      expect(found, `${e.key}: source déclarée`).toEqual([...e.sources].sort())
    }
  })

  it("every source written is one the presence history knows (an inherited price source included)", () => {
    for (const e of LISTING_MUTATION_REGISTRY) for (const src of e.sources) expect(LISTING_PRESENCE_SOURCES, `${e.key}: ${src}`).toContain(src)
    for (const s of presence) if (s.attribution.kind === "inherited_price_source") for (const src of s.attribution.sources) expect(LISTING_PRESENCE_SOURCES, `${s.key}: ${src}`).toContain(src)
  })

  it("no application path (app/, lib/) is left without provenance — and none is « unattributed » on purpose", () => {
    const bare = presence.filter((s) => s.attribution.kind === "none" && !LISTING_MUTATION_REGISTRY.some((e) => e.key === s.key && e.attribution === "wrapper"))
    expect(bare.map((s) => s.key)).toEqual([])
    for (const e of LISTING_MUTATION_REGISTRY) expect(e.sources, e.key).not.toContain("unattributed")
  })

  it("the analysis engines read every declared source (no source falls into « inconnue »)", () => {
    for (const src of LISTING_PRESENCE_SOURCES.filter((s) => s !== "unattributed")) expect(withdrawalReason(src), src).not.toBe("inconnue")
    expect(withdrawalReason("unattributed")).toBe("inconnue")
    expect(withdrawalReason("account_deletion")).toBe("contrainte")
    expect(withdrawalReason("demo")).toBe("technique")
  })

  it("the registry is complete data: entry point, changes, actor; one entry per path", () => {
    const keys = LISTING_MUTATION_REGISTRY.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const e of LISTING_MUTATION_REGISTRY) {
      expect(e.entry.length, e.key).toBeGreaterThan(3)
      expect(e.changes.length, e.key).toBeGreaterThan(0)
    }
  })
})

/** The scanner itself, on small files: what it must and must not count. */
describe("scanner — parses code, does not grep it", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lm-scan-"))
  const scan = (code: string, name = "f.ts"): MutationSite[] => {
    const f = path.join(dir, name)
    writeFileSync(f, code)
    return scanFile(f, dir, KNOWN)
  }
  const one = (code: string) => scan(code).filter((s) => s.effect === "presence")

  it("a NEW unregistered write is found, whatever the formatting", () => {
    const s = one(`async function sneaky(db){ await db\n  .affiliateProduct\n  .deleteMany({ where: { productId: "p" } }) }`)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ fn: "sneaky", method: "deleteMany", attribution: { kind: "none" } })
    expect(LISTING_MUTATION_REGISTRY.some((e) => e.key === `f.ts#sneaky#deleteMany`)).toBe(false) // → the lock fails
  })

  it("an update without isListed provably changes nothing; with it, it does", () => {
    expect(scan(`function a(p){ return p.affiliateProduct.update({ where: { id: "x" }, data: { clicks: { increment: 1 } } }) }`)[0]!.effect).toBe("no_presence_effect")
    expect(one(`function a(p){ return p.affiliateProduct.update({ where: { id: "x" }, data: { isListed: false } }) }`)).toHaveLength(1)
  })

  it("spreads of literals are followed; anything not provable counts as a mutation", () => {
    expect(scan(`function a(p,c){ return p.affiliateProduct.update({ where:{id:"x"}, data: { a: 1, ...(c ? { b: 2 } : {}) } }) }`)[0]!.effect).toBe("no_presence_effect")
    expect(one(`function a(p,c){ return p.affiliateProduct.update({ where:{id:"x"}, data: { ...(c ? { isListed: true } : {}) } }) }`)).toHaveLength(1)
    expect(one(`function a(p,d){ return p.affiliateProduct.update({ where:{id:"x"}, data: d }) }`)[0]!.effectReason).toMatch(/not provable/)
    expect(one(`function a(p,x){ return p.affiliateProduct.updateMany({ where:{id:"x"}, data: { ...x } }) }`)).toHaveLength(1)
    expect(one(`function a(p,args){ return p.affiliateProduct.update(args) }`)).toHaveLength(1)
  })

  it("inserts and deletes always count; nested relation writes and raw SQL too", () => {
    expect(one(`const f = (p) => p.affiliateProduct.createMany({ data: [] })`)).toHaveLength(1)
    expect(one(`function a(p){ return p.user.update({ where:{id:"u"}, data: { affiliateProducts: { deleteMany: {} } } }) }`)[0]!.method).toBe("nested:deleteMany")
    expect(one(`function a(p){ return p.$executeRawUnsafe('UPDATE "AffiliateProduct" SET "isListed" = false') }`)[0]!.method).toBe("raw_sql")
    expect(one('function a(p){ return p.$executeRaw`DELETE FROM "AffiliateProduct" WHERE id = 1` }')[0]!.method).toBe("raw_sql")
    expect(one(`function a(p){ return p.$queryRawUnsafe('SELECT * FROM "AffiliateProduct"') }`)).toHaveLength(0)
    expect(one(`function a(p){ return p.$executeRawUnsafe('UPDATE "AffiliateProductX" SET a = 1') }`)).toHaveLength(0)
  })

  it("attribution: wrapped, declared in the SAME transaction, inherited — never a declaration outside the transaction", () => {
    expect(one(`function a(p){ return withListingPresenceSource(p, { source: "reseller_bulk" }, (tx) => tx.affiliateProduct.updateMany({ where:{}, data:{ isListed: false } })) }`)[0]!.attribution).toMatchObject({ kind: "declared", sources: ["reseller_bulk"] })
    expect(
      one(`function a(p){ return p.$transaction(async (tx) => { await declareListingPresenceSource(tx, { source: cond ? "admin_review" : "exclusivity" }); await tx.affiliateProduct.updateMany({ where:{}, data:{ isListed: false } }) }) }`)[0]!.attribution,
    ).toMatchObject({ kind: "declared", sources: expect.arrayContaining(["admin_review", "exclusivity"]) })
    expect(one(`function a(p){ return p.$transaction([declareListingPresenceSource(p, { source: "supplier_withdrawal" }), p.affiliateProduct.deleteMany({ where:{} })]) }`)[0]!.attribution.kind).toBe("declared")
    // declared, but in ANOTHER transaction than the write: not attribution
    expect(one(`async function a(p){ await p.$transaction(async (tx) => { await declareListingPresenceSource(tx, { source: "script" }) }); await p.affiliateProduct.deleteMany({ where:{} }) }`)[0]!.attribution.kind).toBe("none")
    expect(one(`function a(){ return updateListingWithPriceSource({ where:{id:"x"}, data: body }, { source: "reseller_ui" }) }`)[0]!.attribution).toMatchObject({ kind: "inherited_price_source", sources: ["reseller_ui"] })
    expect(scan(`function a(){ return updateListingWithPriceSource({ where:{id:"x"}, data: { sellingPriceCents: 1 } }, { source: "margin_auto_fix" }) }`)[0]!.effect).toBe("no_presence_effect")
    expect(one('function a(p){ return p.$transaction(async (tx) => { await tx.$executeRaw`SELECT set_config(\'affisell.listing_presence_source\', \'script\', true)`; await tx.affiliateProduct.updateMany({ where:{}, data:{ isListed:false } }) }) }')[0]!.attribution).toMatchObject({ kind: "declared", sources: ["script"] })
  })

  it("test files and dependencies are not scanned", () => {
    expect(presence.some((s) => /__tests__|node_modules|\.test\./.test(s.file))).toBe(false)
  })

  it("cleanup", () => rmSync(dir, { recursive: true, force: true }))
})

describe("declaration helper — the defect fixed: a transaction client was silently not declared", () => {
  it("withListingPresenceSource on a client WITHOUT $transaction (an interactive tx) declares in it before the write", async () => {
    const { withListingPresenceSource } = await import("@/lib/listing-presence/declare")
    const calls: string[] = []
    const tx = {
      $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
        calls.push(`declare:${String(values[0])}`)
        return Promise.resolve([{ s: values[0] }])
      },
    }
    await withListingPresenceSource(tx, { source: "script" }, async () => {
      calls.push("write")
      return null
    })
    expect(calls).toEqual(["declare:script", "write"])
  })
  it("a test double without raw queries still runs the write (nothing invented)", async () => {
    const { withListingPresenceSource } = await import("@/lib/listing-presence/declare")
    let wrote = false
    await withListingPresenceSource({}, { source: "script" }, async () => {
      wrote = true
      return null
    })
    expect(wrote).toBe(true)
  })
  it("an unknown source is recorded as « unattributed », never forwarded", async () => {
    const { declareListingPresenceSource } = await import("@/lib/listing-presence/declare")
    let seen: unknown = null
    await declareListingPresenceSource({ $queryRaw: ((_: TemplateStringsArray, v: unknown) => ((seen = v), Promise.resolve([]))) as never }, { source: "made_up" as never })
    expect(seen).toBe("unattributed")
  })
})
