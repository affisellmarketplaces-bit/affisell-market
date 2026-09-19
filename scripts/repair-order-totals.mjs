// Restores Order.totalCents (VAT-inclusive) where the transfer scheduler overwrote it with the HT line.
// DRY-RUN by default. Writes ONLY with --apply. Never calls Stripe.
// Fingerprint: taxCents > 0 AND totalCents <= subtotal(HT). Restores total = HT + VAT.
import { PrismaClient } from "@prisma/client"

const apply = process.argv.includes("--apply")
const p = new PrismaClient()

const rows = await p.order.findMany({
  where: { taxCents: { gt: 0 } },
  select: { id: true, totalCents: true, subtotalCents: true, sellingPriceCents: true, taxCents: true, stripeSessionId: true, status: true },
})

const fixes = rows
  .map((o) => {
    const net = (o.subtotalCents ?? 0) > 0 ? o.subtotalCents : o.sellingPriceCents
    const total = o.totalCents ?? 0
    return { o, net, total, expected: net + (o.taxCents ?? 0) }
  })
  .filter((r) => r.total <= r.net)

console.log(`${apply ? "APPLY" : "DRY-RUN"}: ${fixes.length} order(s) with a VAT-excluding total`)
for (const f of fixes) console.log(` ${f.o.id} status=${f.o.status} total ${f.total} → ${f.expected} (HT ${f.net} + VAT ${f.o.taxCents})`)

if (apply) {
  let n = 0
  for (const f of fixes) {
    const r = await p.order.updateMany({ where: { id: f.o.id, totalCents: f.total }, data: { totalCents: f.expected } })
    n += r.count
  }
  console.log(`updated ${n}`)
}
await p.$disconnect()
