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
| `pause` | loses money and no price within **+25 %** of today's makes it healthy | one click |
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
  the listing since (`changed_since`). Putting a paused product back online still goes through the identity check.
- **The AI agent never acts.** Its new `getActionPlan` tool is read-only, so it can answer "what should I sell,
  fix or stop today?". Changes stay a click in the hub.

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
