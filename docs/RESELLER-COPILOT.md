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

## 3. Listing health (`loadResellerListingHealth`, `GET /api/affiliate/listing-health`, hub card)

For each product the reseller already sells, the health check is computed:

- at **their own selling price**;
- with **today's supplier price and commission**;
- with **their fee rate** (a negotiated `User.affiliatePlatformFeeBps` wins over the 20 % default).

Issues reported:

- `supplier_price_at_or_above_selling`: the supplier raised the price; no markup is left.
- `net_insufficient` / `net_thin`: the guard's verdict at the reseller's own price.
- `refund_rate_rising`: see the trend test above.

Status is `action`, `watch` or `ok`. The hub card (`AffiliateListingHealthCard`) is server-rendered, so it adds
no hydration. It shows nothing when every listing is healthy, and is translated in 8 locales.

## Data access and rollback

- `loadProductRiskContext` is read-only. It runs three grouped queries (product, category, supplier) whatever
  the catalogue size, and never throws.
- It is off unless `EVENTS_JOURNAL=on`. Without the variable, events are not even read: this is the same full
  rollback as S2.

## Not built yet (needs a decision or a snapshot table)

- **Alerts on change over time** ("the supplier raised the price by 12 % since you listed it"). This needs the
  economics at listing time, which is not stored today. The proposal is an isolated, append-only snapshot,
  written when a listing is created or updated. It would be a new table, so it waits for owner validation.
- **Push or e-mail alerts.** The detection exists. Sending needs consent and a notification preference.
