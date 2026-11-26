# Reseller copilot — adaptive margin guard, opportunity ranking, listing health

Builds on the net-earnings model (PR #17) and the business journal (S2, PR #18). Every figure is an
**estimate** (`estimated: true`): nothing here is a guaranteed margin, and no input is invented — with no
journal data, every result is exactly the previous behaviour (10 % default refund rate).

## 1. Adaptive refund risk (`lib/reseller-refund-risk.ts`, pure)

Hierarchical shrinkage (empirical Bayes) **product → category → platform default**:

- category rate = (refunds + 50 × default) / (purchases + 50)
- product rate = (refunds + 20 × category rate) / (purchases + 20)

A product with no sales takes its **category's measured rate** instead of the global 10 %. A product with
4 refunds out of 4 sales is not treated as "100 % refunded". `upperRate` (mean + 1 posterior sd) is a prudent
rate used for **ranking only**. The guard's yes/no decision still uses the mean rate.

`detectRefundTrend`: two-proportion z-test between the last 30 days and days 31–180. It only reports a rise
when there are at least 15 sales in each window, z ≥ 2 and the rise is at least 5 points. Below that it says
nothing: any "trend" there would be noise.

## 2. Opportunity ranking (`lib/reseller-opportunity-score.ts`)

    score = expected net per sale at the prudent refund rate × (1 + ln(1 + paid sales, 30 days)) × (1 − supplier refund rate)

- Products the guard refuses get a score of 0 and are never recommended.
- The demand term is logarithmic: a best-seller does not crush everything, and a product with no sales yet
  still ranks on its economics.
- Supplier reliability is neutral (1) when unknown.

**Wired into the Opportunity Pulse.** The pulse now examines 3 candidates per pick and orders them by score,
then by the number of resellers watching. Before, it ordered by the number of resellers watching alone.

## 3. Listing health (`loadResellerListingHealth`, `GET /api/affiliate/listing-health`)

For each product the reseller already sells, the health check is computed:

- at **their own selling price**;
- with **today's supplier price and commission**;
- with **their fee rate** (a negotiated `User.affiliatePlatformFeeBps` wins over the 20 % default).

Issues reported:

- `supplier_price_at_or_above_selling`: the supplier raised the price; no markup is left.
- `net_insufficient` / `net_thin`: the guard's verdict at the reseller's own price.
- `refund_rate_rising`: see the trend test above.

Status is `action`, `watch` or `ok`. Shown on the hub through the action plan (section 4).

## 4. Action plan — from signals to actions (`lib/reseller-action-plan*.ts`, `lib/reseller-signals.ts`)

The copilot no longer only describes: it proposes **what to do**, with the reason and the estimated net per sale
before and after.

| Action | When | Autonomy |
| --- | --- | --- |
| `fix_margins` | the supplier raised a SKU price (`marginReviewNeeded`, set by the existing wholesale notifier) | one click → the existing variant-aware `applyMarginAutoFixToListing` |
| `pause` | LOSES money (sold at or below cost, or a negative expected net) and no price within **+25 %** makes it healthy | one click |
| `review_pricing` | still earns a little, too little to recommend, and +25 % does not fix it | recommendation (never a pause) |
| `reprice` | thin / insufficient / supplier cost above its history → the **lowest** price (rounded to 10 cents) that makes it healthy, within +25 %; never on listings with per-variant prices | one click |
| `review_refunds` | still earns, but refunds rise beyond chance | recommendation (a pause would be wrong) |
| `push_momentum` | healthy and demand accelerating (Poisson test, 14 days vs previous 56) | recommendation |
| `list_opportunity` | top scored opportunities not yet listed | recommendation (link to the catalogue) |
| `review_traffic` | ≥ 100 visits, < 0.5 % conversion | recommendation |

Signals (`lib/reseller-signals.ts`, pure, silent without enough data):

- **Demand momentum**: Poisson test on units sold, from paid orders.
- **Supplier cost drift**: today's unit price compared with the unit prices actually charged on paid orders over
  90 days, using median and MAD. It ignores one odd order and noisy histories, and needs at least 3 observations
  and a 10 % move.
- **Traffic without sales.**

**Safety by construction.**

- An action is applied only on the reseller's explicit click: `POST /api/affiliate/copilot/actions`,
  rate-limited.
- Before applying, the server **recomputes the plan**. An action that no longer exists is refused with 409
  `stale`, so a click on an old screen never applies an outdated price.
- Every application is recorded in `AuditLog` (`copilot.apply`) with the listing's state before and after.
- **Undo** (`POST …/actions/undo`) works for 7 days, only by the same reseller, and only if nobody has changed
  the listing since (`changed_since`). Every write is conditional on the row's `updatedAt`, so a concurrent edit is
  never overwritten, and undo restores the supplier price-rise flags (`marginReview*`) a margin fix had cleared. Putting a paused product back online still goes through the identity check.
- **The AI agent never acts.** Its new `getActionPlan` tool is read-only, so it can answer "what should I sell,
  fix or stop today?". Changes stay a click in the hub.

## 5. Is the copilot right? — accuracy (`lib/copilot-accuracy.ts`, `copilot-insights.server.ts`)

Each paid order is accounted for with five amounts that are **never mixed**:

| Amount | Meaning |
| --- | --- |
| estimated | The copilot's own model applied to the checkout snapshot (prices, commission, the reseller's fee rate), before refunds. |
| settled | What the settlement function (`netAffiliateTransferCents`) computes for that sale. |
| due | Settled minus the refund obligations recorded against the reseller (ledger `CLAWBACK`). Zero for an order voided before payout. |
| paid | Money that actually **moved**: `PAYOUT` ledger entries carrying a Stripe transfer id, minus succeeded reversals. `ledger_only` entries are reported apart as "recorded, not transferred". |
| outstanding | Due minus paid. Positive means still owed, negative means over-paid and to recover. It is `null` while the order is not yet payable. |

The model error is `estimated − settled`, on the same scope (one sale, before refunds). Refund calibration (expected
vs realised share) is measured on its own and never folded into that error.

- **Statistics**: bias with its 95 % interval, mean absolute error, relative error, and the share of orders exact
  within ±max(10 cents, 2 %).
- **Verdict**: none under 30 orders (`insufficient_data`). Otherwise:
  - `biased` when the whole interval sits beyond ±2 % of a typical sale;
  - `reliable` when the relative error is ≤ 5 %;
  - `imprecise` in all other cases.
- **Granularity**: computed per category, each category with its own volume.
- **Where to read it**: `GET /api/affiliate/copilot/insights` for the reseller, the hub card for the reseller, and
  `scripts/report-copilot-accuracy.ts` for the owner (platform-wide, read-only).

## 6. Supplier reliability index (`lib/supplier-reliability.ts`)

The index (0–100) is built from paid orders only. It looks at:

- late delivery against the supplier's **own** promise (`handlingDays + deliveryMax`, plus 2 days of tolerance);
- cancellations after payment;
- refunds;
- price rises of ≥ 5 % from one order to the next on the same SKU.

Stock-outs are not included: `Product.stock` defaults to 0 and is not used to hide products, so a 0 does not mean
"out of stock".

How the index stays fair:

- **Recency**: each order weighs `0.5^(age / 60 days)`.
- **Shrinkage**: each rate is pulled towards the platform's measured average, with a prior worth 20 orders.
- **Confidence and minimum volume**: confidence is reported, and below 10 effective orders the index is shown but
  never used to penalise.
- **Explainability**: weak points are named.

**Use in the ranking.** The opportunity ranking multiplies by `index / platform index`, clamped to [0.5, 1.2]. The
multiplier is 1 when the index is unknown or not usable.

## 7. Did the advice work? (`lib/copilot-outcomes.ts`)

Each applied action (not undone) is evaluated by comparing what the listing actually earned per day in the 28 days
before and after it. Possible verdicts:

- `too_early`;
- `insufficient_data` (fewer than 5 orders in a window);
- `beneficial`, `unfavourable` or `neutral` (threshold ±10 %).

A pause is judged on what it stopped: the earnings per sale before it.

These verdicts are **observations, not causal proof**. The copilot "learns" through plain counts per action type
(and per type × category), shown next to a new suggestion ("So far: 9/12 beneficial for you") once at least 10
actions have been judged. There is no opaque model.

## 8. Progressive autonomy (`lib/copilot-autonomy*.ts`, table `ResellerAutonomyRule`)

| Level | What happens | For which actions |
| --- | --- | --- |
| 1. Recommend | information and a link | every action |
| 2. Confirm (default) | prepared; applied on the reseller's click; undoable for 7 days | `reprice`, `pause`, `fix_margins` |
| 3. Automatic | applied by the copilot within the reseller's limits; notified; undoable for 7 days | **only** `fix_margins` and `reprice`, **only** after an explicit grant |

Hard rules:

- **No global grant.** There is one row per action type. The database's CHECK constraints accept only
  `fix_margins` and `reprice`, a price-rise cap ≤ 25 % (`maxPriceIncreaseBps` ≤ 2 500) and 1 to 50 runs per week.
- **A grant needs `consent: true`.** The UI shows the exact sentence with the limits, and the grant is written to
  AuditLog (`copilot.autonomy.grant`) with those limits.
- **A grant and its audit entry are one transaction**: a grant that could not be recorded does not exist (same for
  a revocation).
- **Revocation is one click** (`copilot.autonomy.revoke`). The row is kept with `revokedAt` for the trail.
- **Checked at the moment of each use.** Before every automatic action, one conditional `UPDATE … RETURNING` on the
  rule row (`reserveAutoRun`) checks that the grant is still active, takes one slot of the quota and returns the
  limits in force at that instant. Two concurrent runs serialise on the row lock (measured: 20 concurrent
  reservations against a quota of 3 grant exactly 3). A grant revoked mid-batch, or a tightened limit, applies to the
  very next action. An unused slot (limit exceeded, apply refused) is given back.
- **Quota window**: `maxRunsPerWeek` counts per 7-day window starting at the window's first run
  (`autoRunsWindowStart`, `autoRunsInWindow`). Re-granting never refills a quota already used.
- **The price checked is the price written.** The apply recomputes the plan and refuses (stale) if it suggests any
  price other than the one checked against the limit.
- **Never automatic**, whatever is granted: pausing a product, payments, transfers, anything irreversible.
- **Same guarded path as a click.** The autopilot uses the plan recomputed at that moment and the conditional
  write, and records each action in AuditLog with `source: "auto"`. Each action is notified (`COPILOT_AUTO_ACTION`)
  and undoable.
- **Off by default.** It runs only with **`COPILOT_AUTOPILOT=on`**. The cron `/api/cron/copilot-autopilot` exists
  but is **not scheduled**: scheduling it is the owner's decision.
- **Missing table.** A database without the table means no automation at all. The settings card is then hidden,
  and nothing crashes.

**Deployment order** (same procedure as every schema change, `docs/DEPLOY-SCHEMA-CHANGES.md`):

1. Run `schema:migrate` on staging, then on production (migration `20261126100000_reseller_autonomy_rule`).
2. Run `schema:verify`.
3. Merge.

## Data access and rollback

- `loadProductRiskContext` is read-only. It runs three grouped queries (product, category, supplier) whatever
  the catalogue size, and never throws.
- It is off unless `EVENTS_JOURNAL=on`. Without the variable, events are not even read: this is the same full
  rollback as S2.

## Not built yet (needs a decision or a snapshot table)

- **Change over time**: covered without a new table. The supplier price-rise notifier sets `marginReviewNeeded`,
  which becomes a `fix_margins` action. Cost drift compares today's price with the prices actually charged on paid
  orders.
- **Push or e-mail alerts.** The detection exists. Sending needs consent and a notification preference.
