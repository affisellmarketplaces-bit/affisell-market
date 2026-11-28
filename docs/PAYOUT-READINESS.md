# Payout readiness — AliExpress, webhooks, Vercel Preview, Stripe Test campaign

State on 2026-11-27. **Nothing here is active in production**: production still serves `c593b698c` (deployed 4 Nov);
`main` and PRs #30–#34 are not deployed. Everything below was read in the code or read-only in Stripe **Test**
(`acct_1T9OH1JwTMUiwKQA`, `livemode: false`).

## 1. AliExpress and other supplier purchases (M3)

### Every path that can buy from a supplier

| # | Path | Trigger | Gate in the code |
|---|---|---|---|
| A | `triggerAutoBuyForPaymentIntent` (`lib/fulfillment/auto-buy.ts`) | webhook `payment_intent.succeeded` | `isAutoBuyDisabled()` = `DISABLE_AUTO_BUY === "true"` **or** `AUTO_ORDER_ENABLED === "false"` |
| B | `enqueueAutoBuyForStripeSession` → BullMQ → `workers/auto-order-worker.ts` → `processAutoBuyFulfillmentLog` | checkout fulfilment | same + `REDIS_URL` + a worker running (`npm run worker:auto-order`, outside Vercel) |
| C | `triggerAutoFulfillmentForStripeSession` (`lib/auto-order/enqueue.ts`, called by `stripe-marketplace-fulfill.ts`) | checkout fulfilment | `AUTO_ORDER_ENABLED === "false"` only, + `REDIS_URL` (`isAutoOrderQueueEnabled`) |
| D | `retryAutoBuy` (`lib/admin/auto-fulfill/retry-auto-buy.ts`) | admin action | `isAutoBuyDisabled()` |
| E | `POST /api/orders/[id]/fulfill` → `enqueueOrderPaidJob` → `fulfillAffisellOrderWithAliExpress` | admin session or `CRON_SECRET` + ops auth | **no AUTO_ORDER gate** |
| F | `POST /api/aliexpress/order/create` → `lib/aliexpress-ds-create-order.ts` | `CRON_SECRET` (bearer / header / query / body / HMAC) | **no AUTO_ORDER gate** |
| G | Blind dropship: `payment_intent.succeeded` (flow `blind_dropship`) → Inngest `blind/order.fulfill` → `runBlindDropshipFulfillment` (partner REST adapters, not AliExpress) | webhook | **no AUTO_ORDER gate**; only its transfers are gated (`BLIND_DROPSHIP_ENABLE_STRIPE_TRANSFERS`) |

Money side: auto-order transfers need `AUTO_ORDER_ENABLE_STRIPE_TRANSFERS === "true"`.

**Confirmed defect (code reading): the switch is fail-OPEN.** Only the exact string `"false"` turns auto-buy off.
A missing variable, `"0"`, `"off"`, `"False"` or `" false"` leaves it ON. Paths E, F and G ignore it entirely.

### Proving the production value without changing it

What actually decides is not "the value" but **whether a purchase can start**. Read-only proof, in order:

1. Vercel → project → Settings → Environment Variables, filter `AUTO_ORDER`, `DISABLE_AUTO_BUY`, `REDIS_URL`,
   `AUTO_ORDER_ENABLE_STRIPE_TRANSFERS`, scope **Production**. Note: exists or not, and the exact value (`false`
   lowercase, no spaces). *Absent = ON.* (`vercel env ls production` shows names only; the value is in the dashboard.)
2. Check the deployment that serves production really uses it: the variables are read at runtime per request, but a
   variable added after the deployment applies only to a **new** deployment. Compare the variable's "updated" date with
   the production deployment date (4 Nov).
3. Is a worker running? Railway/other host of `worker:auto-order`: service state. No worker = path B never buys, but C/E/F/G
   do not need it.
4. Evidence in logs (Vercel → Logs, Production, last 30 days): search `[auto-buy]`, `auto_buy_`, `aliexpress`,
   `ds_order`. No line ≠ disabled (there may just have been no paid order).
5. AliExpress side: the DS account's order list (read-only) shows whether any order was placed since 4 Nov.

### Safe disable procedure (for the owner; I change nothing)

1. Production env: `AUTO_ORDER_ENABLED=false` **and** `DISABLE_AUTO_BUY=true` (two independent switches).
2. Leave `AUTO_ORDER_ENABLE_STRIPE_TRANSFERS` absent and `BLIND_DROPSHIP_ENABLE_STRIPE_TRANSFERS` absent.
3. Stop the `worker:auto-order` service (no worker, no queued job executed).
4. Paths E/F: they are protected only by `CRON_SECRET`. Check that no scheduled workflow calls them
   (`.github/workflows/*.yml`: none today) and, if needed, rotate `CRON_SECRET` — **a rotation also stops every
   cron**, so plan it.
5. Redeploy production (owner-authorised) so the variables are certainly loaded, then re-run step 4 of the proof.

**Proposed code fix (not made, needs your decision): fail-closed** — buy only if `AUTO_ORDER_ENABLED === "true"`, and
apply the same gate to E, F, G. Changes the meaning of an absent variable in production, so it must ship with the
variable set explicitly.

## 2. The 13 webhook events (M4)

Production endpoint `we_1TX91J…` (Test) is subscribed to **2** events. Production code (`c593b698c`) handles 8;
`main` handles 13 (`lib/stripe-webhook-processor.ts`, pinned by `lib/stripe-webhook-required-events.ts`).

Idempotency for every event: `ProcessedWebhook` row keyed by `event.id`, re-checked inside the transaction
(`race`), a `failed` row is re-claimed with a conditional `updateMany` (two concurrent retries cannot both run), and a
unique-key race (`P2002`) is a duplicate. So **a repeated delivery is a no-op** for all 13.

| Event | Handler | Out-of-order / repeat behaviour | Needed because | Money-critical |
|---|---|---|---|---|
| `checkout.session.completed` | `processCheckoutSessionCompleted` | order marked paid once (status guard) | creates the paid order and the transfers to schedule | yes |
| `payment_intent.succeeded` | auto-buy trigger + `processMarketplaceCommissionForPaymentIntent`; blind dropship | commission idempotent; auto-buy creates `FulfillmentLog` idempotently | PI-based flows (Lightning, agent, blind) | yes |
| `charge.refunded` | `handleStripeChargeRefunded` → `stripe-commission-refund.ts` | **order-independent**: re-reads the charge from Stripe, one `OrderStripeRefund` per `stripeRefundId` (unique) | refunds reduce what may be paid (`payableAfterRefunds`) and claw back | yes |
| `charge.dispute.created` | `processStripeDisputeEvent` (D7) | opens a hold `dispute:<dp>:<order>`; terminal states are never reopened | an open dispute must freeze payouts | yes |
| `charge.dispute.updated` | same | status-driven, not event-order-driven | evidence / status changes | yes |
| `charge.dispute.closed` | same | won → hold released; lost → applied like a refund; terminal | final outcome | yes |
| `charge.dispute.funds_withdrawn` | same | idempotent on the hold | funds left the platform | yes |
| `charge.dispute.funds_reinstated` | same | idempotent on the hold | funds came back | yes |
| `checkout.session.expired` | `handleStripeCheckoutSessionExpired` | conditional `PENDING → CANCELLED`: a paid order is never cancelled | frees reserved stock / pending orders | no |
| `account.updated` | KYC auto-accept + supplier e-mail | idempotent writes | Connect account becomes payable | no (blocks payouts if missing, never overpays) |
| `customer.subscription.updated` | Radar / Growth / Pro sync | **uses the event snapshot** (see below) | plan features | no |
| `customer.subscription.deleted` | deactivate Radar / Growth / Pro | idempotent | plan features | no |
| `invoice.payment_failed` | `handleStripeInvoicePaymentFailed` | notification | dunning | no |

Dispute safety net when an event is missed: `GET /api/cron/reconcile-disputes` (#32, default mode `report`).

**Confirmed weakness (non-money)**: subscription handlers trust `event.data.object.status`. A delayed
`customer.subscription.updated` (status `active`) delivered **after** `customer.subscription.deleted` would re-enable
Pro/Radar/Growth. Fix proposed (not made): re-read the subscription with `stripe.subscriptions.retrieve` in both cases
and act on the current status.

### Exact Stripe **Test** configuration to apply (owner action — I do not modify the subscription)

Dashboard (Test mode) → Developers → Webhooks → endpoint `…/api/webhooks/stripe` → *Update details* → select the 13
events above, nothing else ("Select all" would add noise without handlers). Then verify:

```bash
STRIPE_SECRET_KEY=sk_test_… npm run verify:stripe-webhooks   # exit 0 = all 13, 2 = money event missing
```

Order of operations: deploy the code that handles them **first** (production `c593b698c` has no dispute handler — the
events would be recorded as `skipped`, and a dispute would not hold payouts).

## 3. Vercel Preview failures (M5)

Facts: Previews #30–#34 fail after ≈ 2 min 45 s; Previews of 04/11 succeeded; `scripts/vercel-build.mjs` and the
migrations are unchanged since; the Vercel connector answers **403** on team `affisell-s-projects`
(`team_kXIX5Q02qCmWRMUj1rlmqKz2`), so I cannot read build logs.

Candidate causes, by evidence:

| Cause | For | Against | Distinguishing log line |
|---|---|---|---|
| **Preview database refused / unreachable** (staging branch `ep-shy-wind-…` suspended, deleted, or Preview `DATABASE_URL` not staging) | pipeline stops at the first failing step; 2 min 45 s fits `npm install` + `prisma generate` + verify; billing interruption may have suspended Neon or changed vars | none yet | `schema-deploy.mjs verify` → `refused` / exit **2** or **3** (wrong endpoint), `P1001 Can't reach database`, or exit **5** (catalog check) |
| Preview env variables missing (billing reset, or a var added only to Production) | same timing | Production builds also fail? (unknown) | `Missing DATABASE_URL`, `DIRECT_URL`, exit 2 "refused" from `vercel-build.mjs` |
| Dependency install | — | lockfile unchanged | fails in "Installing dependencies", `npm ERR!` / `ERESOLVE`, before `prisma generate` |
| Next build (type / OOM) | — | would take longer than 2 min 45 s | after `check:client-prisma`, `Type error:` or `JavaScript heap out of memory` |

**What I need from you (one of):**

- Open the latest failed Preview (deployment of PR #34) → *Build Logs* → copy the **last 40 lines**; or
- run `npx vercel inspect <deployment-url> --logs --scope affisell-s-projects` and paste the tail; or
- give the Vercel connector access to team `affisell-s-projects` (Vercel → Team Settings → Integrations / Claude), and I read them myself.

Also check: Neon console → branch `ep-shy-wind-…` exists and is not suspended; Vercel → Env Vars → scope **Preview**
has `DATABASE_URL`, `DIRECT_URL`, `DATABASE_URL_UNPOOLED` all naming that same endpoint. No new build should be
triggered until one of these gives new information.

## 4. Stripe Test validation campaign — additions (M6)

Extends `docs/STRIPE-TEST-MODE-CAMPAIGN.md`. Rules: **new isolated Test objects only** (fresh customer, fresh Connect
test accounts `acct_…` created for the run, metadata `campaign=2026-11-27`); nothing historical is refunded, reversed
or deleted. Preflight before and after each scenario: `npm run preflight:payouts -- --days 1`.

| # | Scenario | How | Expected | Observed |
|---|---|---|---|---|
| C15 | Beneficiary with several historical transfers for one order | `transfers.list` adoption sees 2 transfers same group + destination + role | attempt held `EXISTING_TRANSFERS_SEVERAL`, no `transfers.create`; preflight BLOCKED `stripe_duplicates` | unit-tested (#33, #34); not run on Stripe Test |
| C16 | Legacy lowercase role | existing transfer `metadata.role=supplier` | adopted, no second transfer | unit-tested (#33) |
| C17 | Transfer list incomplete | `has_more=true`, none matching | held `EXISTING_TRANSFERS_UNLISTED` | unit-tested (#33) |
| C18 | Stripe list error during Lightning | `transfers.list` throws | no claim, `payoutStatus` stays `PENDING` | unit-tested (#33) |
| C19 | Incoherent ledger | ledger `PAYOUT` > payable after refund | preflight BLOCKED `ledger_invariants` (`paid_more_than_payable`) | SQL-tested on local PostgreSQL (#31) |
| C20 | Stripe transfer not recorded | a Test transfer on a new order, no ledger row | preflight BLOCKED `stripe_ledger_consistency` | unit/integration-tested (#34) |
| C21 | Webhook missing money events | current Test endpoint (2 events) | preflight BLOCKED `webhook_subscription` | **observed** on Stripe Test via the connector: 2 of 13 events subscribed |
| C22 | Dispute missed by the webhook | create a Test dispute (`4000000000000259`), endpoint without dispute events | `reconcile-disputes` report lists `missing_hold` | unit-tested (#32) |

"Observed" stays empty until the campaign runs on a Preview/staging deployment of `main` + #30–#34, which needs the
Preview build fixed first (§3).
