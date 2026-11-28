# Supplier purchases — inventory, lock, consequences, procedures

State: branch `local/supplier-purchase-gate` (PR #35). **Developed and tested, not merged, not deployed.** Nothing here is
active in production; production still runs `c593b698c`.

## 1. "Eleven paths" reconciled

The 28/11 report's table had **10 rows because it listed defects, not paths**. The paths are the **11 entry points**
below. They all end in **6 choke points** (the only functions that contact a supplier or move money to one). The
lock sits in the choke points, so an entry point cannot bypass it.

### Entry points (who starts a purchase)

| # | Entry point | File · function | Trigger | Ends in choke point |
|---|---|---|---|---|
| A | Webhook auto-buy | `lib/fulfillment/auto-buy.ts` · `triggerAutoBuyForPaymentIntent` → `processAutoBuyFulfillmentLog` | `payment_intent.succeeded` | ①, then ② as fallback, card ⑥ |
| B | Auto-buy BullMQ worker | `lib/fulfillment/bullmq/auto-buy.queue.ts` → `processAutoBuyFulfillmentLog` | queue | ①, ②, ⑥ |
| C | Checkout → batch engine | `lib/auto-order/enqueue.ts` → `lib/auto-order/engine.ts` · `runAutoFulfillmentBatch` | checkout fulfilment | ⑤ then ①/③/④ (adapter) |
| D | Admin retry | `lib/admin/auto-fulfill/retry-auto-buy.ts` | admin | as A |
| E | Manual / cron fulfil | `app/api/orders/[id]/fulfill/route.ts` → `fulfillAffisellOrderWithAliExpress` | admin or `CRON_SECRET` | ① |
| F | Ops create-order | `app/api/aliexpress/order/create/route.ts` | `CRON_SECRET` | ① (needs `orderId` or `idempotencyKey`) |
| G | Blind dropship | `inngest/functions/fulfill-blind-dropship-order.ts` → `lib/blind-dropship-fulfill.ts` | `payment_intent.succeeded` (blind) | ④ |
| H | Engine → CJ adapter | `lib/suppliers/adapters/cj-dropshipping.adapter.ts` · `placeOrder` (creates **and pays**) | engine, inline or worker | ③ |
| I | Engine → AliExpress / blind-REST adapters | `aliexpress.adapter.ts`, `blind-rest.adapter.ts` | engine, inline or worker | ①, ④ |
| J | China buying agents | `lib/china-buying/route-china-buy.ts` → `adapters/superbuy.ts`, `anovabuy.ts` | after payment, supplier import, `/api/supplier/china-buy` | ⑦ |
| K | Engine supplier payment | `lib/auto-order/payment/index.ts` · `executeSupplierPayment` | engine, before placement | ⑤ |

### Choke points (where the lock is)

| | Choke point | Channel | Reservation (claim key) | Double-order protection | Timeout / no answer | Tests |
|---|---|---|---|---|---|---|
| ① | `createAliExpressDsOrder` (`lib/aliexpress-ds-create-order.ts`) | `aliexpress` | `order:<Order.id>` (shared by A–F, I) | one claim per order across every path; `placed` replays the stored id | stops at the first call that may have reached AliExpress → `uncertain`; only "method not available" moves on | gate test: 1 call after timeout, replay across paths, refusal = 1 call |
| ② | `runAliExpressBrowserCheckout` (`lib/fulfillment/ae-browser-checkout.ts`) | `aliexpress` | same keys as ① | never runs after an uncertain or guard answer from ① | no real pay step exists (it answers `USE_DOCKER_WORKER`); a future one must use the guard (inventory test) | gate test + source pin |
| ③ | CJ `placeOrder` | `cj` | `order:<id>` per line; **continues the engine's claim** (token) | claim; the token cannot be forged | 4xx = refused · timeout / 5xx / no id = `uncertain`; an unpaid created order = `placed` (no second order) | gate test + engine test |
| ④ | `RestSupplierAdapter.createOrder` (`lib/suppliers/rest-adapter.ts`) | `partner_rest` | `blind:<order>:<supplier>` or the engine's `order:<id>` + token | claim; an Inngest retry gets the stored id back | 4xx = refused · no answer / 5xx / no id = `uncertain` | gate test (Inngest retry), blind payload tests |
| ⑤ | `executeSupplierPayment` (wallet / Stripe Connect) | `supplier_payment` | **the engine's claim** (no claim = refused) | wallet: debit + `paidCents` stamp in one transaction, only if not paid yet; Stripe: idempotency key `supplier_pay_<claim token>` + transfer id stamped | Stripe error = "money may have moved" → `uncertain` | engine test, PostgreSQL concurrency suites |
| ⑥ | `createAutoBuyVirtualCard` (Stripe Issuing) | `aliexpress` (policy) | — (creates spending power, not an order) | policy only | — | gate test |
| ⑦ | `chinaAgentPurchase` (`lib/china-buying/adapters/agent-purchase.ts`) | `china_agent` | `order:<id>` when the route has an order, else `china:<idempotencyKey>` | claim (the agent's own `ChinaBuyRouteLog` key is checked before the call and written after it, so it cannot stop concurrent calls — the claim does) | 4xx = refused · timeout / 5xx / answer without reference = `uncertain` (the invented `superbuy_<timestamp>` reference is gone) | engine test: 2 concurrent routes = 1 HTTP call |

Outside the lock on purpose: `AFFISELL_NATIVE` (the supplier fulfils its own order), `MANUAL` (an e-mail), and the stub
channels (TEMU, BIGBUY, ZENDROP, AMAZON, TIKTOK_SHOP: log only). None of them places a paid external order. If the
engine also **pays** them (wallet / Connect), the payment is locked (⑤, channel `supplier_payment`).

**Automated barrier**: `lib/__tests__/supplier-purchase-inventory.test.ts` scans `lib/ app/ workers/ inngest/ scripts/`
for the network markers of a purchase or of a supplier payment: AliExpress place-order methods, CJ create / pay, the
partner REST create path, China agent endpoints, `issuing.cards.create`, the wallet debit, the supplier transfer.
**Any file with a marker must call the policy or the guard, or the test fails.** It also checks that the AliExpress
place-order methods are called from a single module.

## 2. The lock

- **Policy** (`lib/supplier-purchase/policy.ts`): a purchase needs `SUPPLIER_PURCHASES_ENABLED=true` (exact) **and** its
  channel in `SUPPLIER_PURCHASE_CHANNELS` (`aliexpress`, `cj`, `partner_rest`, `china_agent`, `supplier_payment`).
  `DISABLE_AUTO_BUY` (other than absent / `false`) or `AUTO_ORDER_ENABLED` (other than absent / `true`) stops
  everything. Absent, misspelt, ambiguous or unknown → refused.
- **Daily quota (canary by construction)**: an open channel also needs an entry in `SUPPLIER_PURCHASE_DAILY_LIMITS`
  — `channel=N` (N = purchases STARTED in the last 24 h, 0–10000; a supplier refusal does not count) or
  `channel=unlimited`, comma-separated. No entry = refused (`daily_limit_absent`). The count and the claim happen in
  ONE transaction under a per-channel lock (`pg_advisory_xact_lock`, released at commit), so concurrent purchases can
  never overshoot it — proven on PostgreSQL with a control run that overshoots without the lock
  (`scripts/sql/test-supplier-purchase-claim.ts`, 7b). Quota used up → `daily_limit_reached`: nothing sent, the
  engine flags the order `MANUAL_REQUIRED`, and checkout refuses new lines depending on that channel. A replay of an
  order already placed still gets its stored id. `channel=0` = listed but paused.
- **Claim** (`lib/supplier-purchase/guard.server.ts`, table `SupplierPurchaseClaim`): one row per **order**, holding a
  random token.
  - Allowed transitions: `claimed` → `placed` | `rejected` | `uncertain`.
  - Only an **unpaid** `rejected` claim can be claimed again; the database itself refuses "paid and rejected".
  - The batch engine **holds one claim across payment and placement**: inline or in the BullMQ worker, the adapter
    continues it with the token.
  - A crash between payment and placement leaves "claimed, paid". That claim is refused automatically and appears in
    the reconciliation report.

## 3. Commercial consequences of deploying #35

- **Blocked immediately, all at once**, because neither new variable exists in production:
  - the 7 choke points above, i.e. auto-buy, the engine with AliExpress / CJ / blind REST, blind dropship, China agents
    and supplier payments;
  - the two ops routes (E, F).
  - Not blocked: native suppliers, who ship their own orders, and manual providers.
- **What is NOT blocked**: checkout. A buyer **can still pay** for a product that only ships if Affisell buys it.
  Nothing changes on the customer side, so these orders stay `paid` with no supplier order.
- **Orders already accepted**:
  - paid orders whose purchase has not started stay as they are: no purchase, no error;
  - queued work (`FulfillmentLog` PENDING/BUYING, `AutoFulfillmentBatch` PENDING/PROCESSING, blind orders `paid`)
    finds the lock closed and stops without buying;
  - nothing already bought is cancelled or refunded.
- **Measure before deploying** (read-only, server-enforced):
  `DATABASE_URL='<prod url>' npm run report:supplier-purchase-impact`. It reports live products that depend on an
  automatic purchase, by channel; paid orders from the last 60 days still waiting (count, amount, oldest); and queued
  work. It counted 0 locally; **production has not been measured** (no access from here).
- **So that no customer pays for an order that cannot ship — decision for the owner**:
  1. *Recommended*: while a channel is closed, take its dependent products out of checkout (unpurchasable, or marked
     "temporarily unavailable"). This needs a checkout change, which is not built yet.
  2. Keep selling and fulfil by hand (supplier dashboard), within the delivery promise.
  3. Refund automatically after N days without a supplier order. This is a money path and needs separate
     authorisation.
  Before any of these, run the impact report: if it shows 0 dependent live products, the question disappears.
- **Re-enabling a channel, explicitly and under control** (owner, once, per channel):
  1. migration applied (§4);
  2. `npm run report:supplier-purchase-claims` → nothing open;
  3. set `SUPPLIER_PURCHASES_ENABLED=true`, `SUPPLIER_PURCHASE_CHANNELS=<one channel>` (e.g. `cj`), plus
     `supplier_payment` if the engine pays that supplier, and a SMALL quota for each, e.g.
     `SUPPLIER_PURCHASE_DAILY_LIMITS=cj=3,supplier_payment=3` — raise it only after the first orders reconcile;
  4. redeploy, so the variables are certainly loaded;
  5. watch `[supplier-purchase]` logs for the first orders, then re-run the claims report;
  6. to close again, remove the channel from the list (or `SUPPLIER_PURCHASES_ENABLED`): effective at the next request.

## 4. Migration `20261127120000_supplier_purchase_claim`

**Proven on an isolated database** (`scripts/sql/test-supplier-purchase-claim-migration.sh`, local copy at the previous
schema version, 141 tables; 16/16 checks):
- no row lost or changed;
- outside the new table, the schema is byte-identical, so the previous code version is unaffected;
- 6 constraints present, primary key = one claim per key;
- a second application fails loudly;
- rollback (`DROP TABLE`) restores the identical schema with every other row intact.

**Table missing** (code deployed without the migration): every purchase is refused, with nothing paid and nothing sent
(proven on PostgreSQL in `test-supplier-purchase-engine-race.ts`). The Vercel build also stops before that: its
`schema verify` step fails on a pending migration (exit 5).

**Safe state**: keep the table. Dropping it forgets which orders were bought. To stop purchases, close the policy
instead (§3). The previous code never reads the table, so reverting the code is safe with the table in place.

**Order** (owner): staging `schema:migrate -- --expect-endpoint <staging ep>`, then `schema:verify`, then production
the same way, **before** deploying #35. Not applied anywhere except local throwaway databases.

**Repository history (found while testing)**: the repo's migration history cannot be replayed on an empty database —
`20260801210000_sponsor_success_fee` alters `SponsorCampaign` before any migration creates it. This was already the case
before #35 and does not affect databases that already exist. It does mean a staging branch cannot be rebuilt from
zero with `migrate deploy`.

## 5. Reconciliation (claims the code will never retry)

- `DATABASE_URL='<url>' npm run report:supplier-purchase-claims`: READ-ONLY. Lists `uncertain`, `claimed` older than 15
  min, and paid-not-placed claims, each with its action. Exit 2 if any.
- `npm run resolve:supplier-purchase-claim -- --key order:<id> --as placed --supplier-order <id> | --as rejected | --as refunded [--apply]`.
  - **Dry-run by default**; refused on production by accident.
  - Acts only from `claimed` / `uncertain`.
  - `rejected` is refused by the database if money left.
  - `refunded` means the money was returned **beforehand, outside** (wallet credited / transfer reversed).
- Decision rule: **look first** (supplier dashboard by reference, Stripe transfer by `purchaseClaimToken` metadata).
  An order exists → `placed`. No order and no money → `rejected`. No order but money left → return it, then
  `refunded`. Never re-run a purchase while in doubt.

## 6. Proof

| Suite | What | Result |
|---|---|---|
| `supplier-purchase-gate.test.ts` | policy table, guard, every path closed by default, AliExpress timeout = 1 call, CJ 5xx, Inngest retry | pass |
| `supplier-purchase-engine.test.ts` | engine sequence: retry, concurrent runs, crash after payment, resume, refusal / timeout after payment, insufficient balance, Stripe Connect, forged token, native adapter, China agents (2 concurrent = 1 call), reconciliation | pass |
| `supplier-purchase-inventory.test.ts` | no purchase marker outside the lock | pass |
| `scripts/sql/test-supplier-purchase-claim.ts` | the guard's exact SQL on PostgreSQL: claim races, **5 concurrent debits of one claim → 1 debit** (×3), two purchases on a wallet that covers one → 1 debit and never negative, **session killed mid-transaction → no stamp, no debit**, 5 database constraints | 25/25 |
| `scripts/sql/test-supplier-purchase-engine-race.ts` | **the real TypeScript code** (`sqlClaimStore`, `beginSupplierPurchase`, held-token guard, `executeSupplierPayment`) on PostgreSQL with concurrent sessions: 8 concurrent runs → 1 claim / 1 debit / 1 supplier call; crash + 3 concurrent resumes → 0 extra debit; overlapping multi-order purchases leave nothing half-claimed; table missing → refused | all pass |
| `scripts/sql/test-supplier-purchase-claim-migration.sh` | §4 | 16/16 |
| Mutations | unit level: policy, guard, AliExpress loop, inventory, China; PostgreSQL level: wallet stamp ignoring a payment (caught), partial multi-key claim (survived the first version of the test → test strengthened → caught) | all killed |

Run the PostgreSQL suites with
`PGHOST=/tmp PGPORT=55432 PGUSER=postgres PGDATABASE=affi npx tsx --conditions react-server scripts/sql/<suite>.ts`.
They run only on a local throwaway database.
