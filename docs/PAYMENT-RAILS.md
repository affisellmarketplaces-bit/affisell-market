# Payment rails — several payment methods and countries, no single-provider dependency

Status: **architecture and test double only**. No provider account, contract, key, network call or money movement.
The real adapters (pawaPay, FedaPay…) are written once the owner has chosen a provider and opened a sandbox account.

## Why

- **Regulation (verified, official sources).** BCEAO Instruction n°001-01-2024 of 23 January 2024 governs
  payment services in the UMOA (Benin, Senegal and the other WAEMU countries). Since **1 May 2025**, any structure
  without the licence must stop offering payment services there (BCEAO Notice n°004-03-2025). At 31 August 2026,
  the BCEAO listed **34 licensed payment institutions**, 4 of them in Benin and 11 in Senegal.
  - Consequence: Affisell must never collect or hold buyers' money itself in the UMOA.
  - A **licensed** provider collects, splits and pays out; Affisell only instructs it.
- **Resilience.** Mobile Money aggregators differ by country, operator, fees and settlement delay, and they have
  incidents. The marketplace core (orders, settlement, ledger) must not depend on any one of them.

## Design (`lib/payment-rails/`)

| File | Role |
| --- | --- |
| `types.ts` | The `PaymentRail` contract: capabilities (country, currency, method, limits, operators), fee schedule, idempotent `createCollection` / `refund`, `parseWebhook`. |
| `core.ts` | Shared pure logic, written once for all providers (detailed below). |
| `simulated-rail.ts` | In-memory provider that behaves like an aggregator: asynchronous phone confirmation, HMAC-signed callbacks, replay window. It is the **test double every real adapter must pass**, and the way to build the checkout flow before a provider is chosen. Never registered in production. |

What `core.ts` contains:

- **Money units.** XOF has **no minor unit**, so 1 500 FCFA is stored as 1500, never 150000.
- **Fee estimates**, rounded up.
- **Phone-number normalisation.** Benin uses 10 digits since 2024 and Senegal 9. The operator is never inferred
  from the number, because numbers are portable.
- **Forward-only state machine.** A "failed" received after "succeeded" is **never applied**: it goes to human
  review.
- **Routing.** The owner's preference per country comes first, then the estimated fee. Disabled rails are skipped,
  and every remaining candidate is a fallback.
- **Request validation**, with language-neutral error codes.

Rules every adapter must respect, proven on the double by `lib/__tests__/payment-rails.test.ts`:

1. **Idempotence.** The same key returns the same collection, with no second charge. The same refund key returns
   the same refund.
2. **Webhooks.** Signature and timestamp are checked, then the event is normalised. Tampered, unsigned or stale
   callbacks are refused.
3. **No exception for a business refusal.** It becomes a `failed` status instead.
4. **Refund ceiling.** A refund only applies to a succeeded collection and never exceeds the amount paid.

## Not decided — owner / lawyer

- **Provider for the pilot.** Candidates are pawaPay and FedaPay, plus the others in the Mobile Money study. A
  sandbox account is needed to write and test the real adapter. Opening one creates an account and accepts terms,
  so I am not doing it without your go-ahead.
- **Pilot country.** Benin or Senegal.
- **Split model.** Either the licensed provider splits and pays sellers, or it collects for Affisell's licensed
  partner. This is a legal opinion, required before any real money moves.
- **Integration point.** The integration with the current Stripe checkout (`lib/marketplace-checkout.ts`) is
  deliberately **not** touched here. It is the next step, behind a switch, once a provider is chosen.
