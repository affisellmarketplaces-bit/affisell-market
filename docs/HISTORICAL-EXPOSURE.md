# Historical exposure — real listed days for the sheet-quality measure and the copilot learning

Founder brief 2026-11-24 « Historical Exposure Intelligence ». Portfolio row 44. Nothing is active: `HISTORICAL_EXPOSURE_MODE` is `off` by default and the presence migration (`20261124090000_listing_presence_history`) is applied nowhere.

## 1. The problem

Before this change, two analyses estimated how long a product had been on sale from **today's live listings**:

- **Sheet quality ↔ sales** counted days from each live listing's `createdAt`. It had three errors:
  - it counted the withdrawn days of a listing withdrawn and then relisted (over-estimate);
  - it missed listings that were withdrawn or deleted before today (under-estimate);
  - it still counted the orders of those missed listings (rate inflated).
- **Copilot learning** called a mature addition with no sale in 30 days « ajouté sans vente », even when the reseller withdrew the product after two days. That teaches the copilot that its advice failed, although the product was never really on sale.

## 2. One measure, no second history

`lib/listing-presence/exposure.ts` (pure) sits on top of `rebuildPresence` (`periods.ts`). It does not add a second tracking system. It is shared by three analyses: sheet quality, copilot learning and the blind-spot detector. The blind-spot detector now imports `knownListedIntervals` instead of keeping its own copy.

Its rules:

- **A listed day is a known listed day.** That means a period with exact edges, or a period with an unknown start that is counted only from when history began.
- **Unknown time stays unknown.** Days before history began, and the days around a missing event, are counted as `unknownDays`. They are never counted as listed or as unlisted.
- **Withdrawn days are not exposure.** A relisting opens a new period.
- **No double counting.** The periods of every listing of one shop are merged (`mergeIntervals`).
- **Orders are tied to their shop's periods.** An order counts only if it was paid while that shop's listing was known to be listed. Other orders are counted apart, in `ordersOutsideKnownPeriods`.
- **Time is UTC and windows are half-open.** Instants are UTC epochs (the trigger writes `clock_timestamp() AT TIME ZONE 'UTC'`). Intervals are half-open, `[start, end)`: two events at the same instant close one interval and open the next with no gap and no overlap.

## 3. Coverage and reliability (per window, never global)

`windowCoverage(read, from, to)` returns one of these levels:

| Level | Meaning |
|---|---|
| `complete` | History was read in full and began at or before the window start. |
| `partielle` | History began inside the window. |
| `absente_sur_la_fenetre` | History began after the window. |
| `indisponible` | The migration is not applied, or the history cannot be read. |
| `lecture_tronquee` | The read was capped. |

Only `complete` is usable. An applied migration is not enough, and neither is a listing's first event: it is not the listing's real start. A history that covers a recent window does not cover an older one (tested).

`exposureReliability(listed, unknown, anomaly)` is computed per product or per case:

- `fiable`: unknown days are at most 10 % of the time, and no event is missing in the window;
- `partielle`: unknown days are at most 50 %;
- `incertaine`: anything worse.

Only `fiable` is measured.

## 4. Transition (`HISTORICAL_EXPOSURE_MODE`)

The switch is read per request and is a founder decision. Its three values:

| Mode | Sheet quality | Copilot learning |
|---|---|---|
| `off` (default) | Nothing is read; the report is the same as before (tested). | No `exposure` block; same report as before (tested). |
| `observe` | History is read when the window is `complete`. The report gains `exposureBasis` (coverage level, old-vs-new comparison, lifecycle profile). Verdicts stay on the live estimate. | Each mature addition is qualified (§6) and the report gains an `exposure` block. The discovery engine keeps the reference outcome. |
| `on` | If the window is `complete`, the **whole** report is measured on history. Products whose own history is not `fiable` are left out and counted in `excludedUnreliable`, never measured on the live estimate. Otherwise the live estimate is used, and the report says so. | If **every** mature addition is covered, the discovery engine tests « sold within H listed days ». Otherwise it keeps the reference outcome (never a mix). |

The report states what was really used:

- `exposureBasis.used` and `discovery.saleBasis` name the basis;
- the limit `listing_history_estimated` disappears only when history was used;
- three limits appear in its place: `presence_is_not_traffic`, `availability_history_not_recorded`, `censoring_of_short_listings`.

What resellers are shown is unchanged. The `opportunity.track` line stays on the reference definition, because the new measure means something else (« within 14 listed days », not « in 30 days »). Wording it for resellers is a separate decision.

## 5. Old vs new

`compareExposureMethods` and `compareQualityExposure` compare the two methods product by product:

- `overestimated`: the live estimate is higher, for example a listing withdrawn and relisted;
- `underestimated`: the live estimate is lower, for example listings withdrawn or deleted before today;
- `agree`: within ± 1 day or ± 5 %;
- `missedByLive`: products that history shows on sale and the live estimate does not;
- `medianRatio`: the median of history ÷ live;
- `ordersOutsideKnownPeriods`.

This is a correction of the denominator. Sales are not changed, and no commercial gain is claimed: the tests use synthetic data, and no real data exists yet.

## 6. Copilot: what a « no sale » means

`lib/reseller-copilot/learning-exposure.ts` reads only the history of **that** reseller's listing (`presenceForCase`). Coverage is judged per case: history must have begun at or before the addition. The horizon `H` is 14 days, the floor of the temporal engine (pinned by a test).

| Class | When |
|---|---|
| `vendu` | First sale in the first period, before H listed days. |
| `vendu_apres_remise_en_vente` | First sale in a later period, after a relisting. |
| `vendu_apres_longue_exposition` | First sale after H or more listed days. |
| `non_vendu_exposition_suffisante` | H or more listed days, no sale. This is the only « no sale » that judges the advice. |
| `retire_trop_tot` | Withdrawn before H listed days, and not listed at the end of the window. |
| `non_vendu_exposition_insuffisante` | Fewer than H listed days for another reason. |
| `ininterpretable` | Coverage starts after the addition, the read was capped, or presence is not reliable. |

The measure « sold within H listed days » counts outcomes like this:

- **success**: the first sale came before H listed days;
- **failure**: the listing reached H listed days without a sale;
- **censored, left out**: every other case.

Leaving only unsold short listings out would flatter the advice, and counting them would blame it; this rule treats both sides the same. The block also shows:

- the reference outcome on the same covered cases (`legacyOnCovered`);
- `countedAsFailureButNotReallyExposed`, the cases the old definition calls failures although the product was never really on sale.

The existing guardrails are unchanged: minimum volumes of 20 cases and 5 resellers, Wilson intervals, Benjamini–Hochberg in the discovery engine, `applied: false`. Only orders paid before the reading time and inside the case's own window are read, so no future data leaks in (tested).

## 7. Lifecycle profile (additional innovation, descriptive)

`lifecycleProfile` asks when a listing stops selling and whether a relisting changes that. It measures paid orders per 100 listed days:

- by **age of the period**, counted from its own known start: 0–14 days (the reference), 14–45 days, 45 days and more;
- for the **first period** compared with a **period opened by a relisting**.

How it is computed:

- **Floors.** A cell is read only with at least 300 listed days, 5 resellers and 5 orders.
- **Ratio.** It is a log-Poisson rate ratio with a 95 % interval, read as `plus_haut`, `plus_bas` or `non_concluant`.
- **Left out.** Periods with an unknown start are left out, because their age is unknown.
- **Nature.** The result is an observed association, never a cause.

It has known biases:

- a period that lasts is one the reseller kept, often because it sells;
- season is not neutralised;
- presence is not traffic.

It is served in `exposureBasis.lifecycle` of the admin route `GET /api/admin/listing-quality-effect`. Suppliers never see it: their route returns selected fields only.

**Not built:** detecting when one specific sheet « stops being effective ». That would need traffic and the history of the sheet's content, and neither is recorded.

## 8. Limits

- Presence is not traffic: a listed product is not a product that was seen.
- Availability is not historised, so stock-outs are not removed from the exposure.
- Censoring is not random: a reseller tends to withdraw what it doubts.
- A deleted listing has no `createdAt` in the learning loop. The reference outcome then treats the case as not added (unchanged).
- Nothing is measured on real data yet, because the migration is not applied.

## 9. Tests

- **`historical-exposure`**, 33 tests:
  - the 20 required cases: continuous exposure, separate periods, withdrawal, relisting, deletion, a sale inside a period, unknown start, incomplete history, coverage complete on a recent window and partial on an older one, absence of history, chronology anomaly, simultaneous events, UTC, no double counting, fallback, no approximation shown as history, coherence between the three analyses, reseller isolation, no future leakage, regression;
  - the copilot classes, the comparison and the lifecycle profile.
- **`historical-exposure-db`**, on a real PostgreSQL, in CI: the trigger writes the events in an Asia/Tokyo session; the shared measure reads exactly the listed time, puts each sale in its shop's period, and isolates resellers.
- **Unchanged and passing:** `listing-quality-effect`, `copilot-learning`, `copilot-blind-spots`, `listing-presence`, `copilot-temporal`, `listing-mutation-provenance`.
