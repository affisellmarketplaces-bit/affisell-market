# Home page performance — November 2026 (after PR #15 and #16)

Measured locally with the CI Lighthouse settings (mobile, 375×667, RTT 150 ms, 1.6 Mb/s, CPU ×4),
production build, 3 runs, median. The same machine and settings were used before and after each change.

| | #16 (before) | this PR | change |
| --- | --- | --- | --- |
| Module JS on first load (gzip) | 428 KB | 359 KB | −16 % |
| LCP | 5.13 s | 4.24 s | −0.9 s |
| TBT | 1.59 s | 1.32 s | −17 % |
| TTI | 8.0 s | 6.9 s | −1.1 s |
| FCP | 1.68 s | 1.68 s | = |

The budgets in `lighthouse-budgets.cjs` are unchanged. Absolute values are higher locally than in CI (slower CPU);
only the before/after difference is meaningful.

## What was on the critical path

framer-motion (44 KB gzip) was loaded and evaluated before the page became interactive, through four paths:

1. **The hero** (the LCP block) was a client component wrapped in `<motion.div initial={false}>` — an animation
   that never ran. It is now a server component (`components/home/buyer-premium-hero.tsx`); only the search box and
   the rotating slogan hydrate.
2. **`useIdleInViewMount`** used framer-motion's `useInView` for one IntersectionObserver. Replaced by a native
   `useInViewOnce` (same once-only semantics; very old browsers without IntersectionObserver mount the content).
3. **The ⌘K chip** imported an event-name constant from the palette module, which pulled the palette (cmdk,
   framer-motion) into the header. The constant lives in `components/command-k-events.ts`.
4. **The reseller and supplier navs** imported the palette statically; every visitor downloaded it because
   `site-nav` imports all navs. Now `next/dynamic` (still server-rendered, loaded only when that nav renders).

`lib/__tests__/home-critical-path-js.test.ts` fails if any of these paths comes back.

## Remaining bottlenecks (measured, not yet treated)

- **Hydration**: React's own chunk still takes ~1.8 s of script time (CPU ×4). The marketplace layout
  (`buyer-premium-marketplace-layout.tsx`) is a client component only to read `?category=`; moving that read to the
  server would let the department rails render without hydration. Next candidate, lower gain than this PR.
- **CSS**: one 1.04 MB stylesheet (111 KB gzip), see below.

## Recommendation — the 343 KB of colour fallbacks in the CSS

**What it is.** `browserslist` targets `Chrome >= 109` and `Safari >= 15.4`. Those versions do not support
`color-mix()` (Chrome 111, Safari 16.2, Firefox 113), so Tailwind emits every colour with an opacity modifier
twice: a plain fallback plus the `color-mix()` version inside `@supports (color:color-mix(in lab, red, red))`.
Those blocks weigh **343 KB raw**; removing them takes the stylesheet from 111 KB to **89 KB gzip** (−22 KB),
and less CSS to parse on every page.

**Who needs it.** Chrome 109 is the last version for Windows 7/8/8.1. StatCounter (Africa, mid-2026): Windows 7
and 8.x are about 0.6–1.1 % of Windows versions, and Windows about 18 % of all operating systems — about
0.1–0.2 % of traffic. The real unknown is **old Android phones whose Chrome/WebView is not updated**, which
public statistics do not separate well and which matter for West Africa.

**Recommendation: keep the fallbacks for now; decide on Affisell's own data.**

1. Measure: the share of real sessions whose browser fails `CSS.supports("color", "color-mix(in lab, red, red)")`
   (one boolean in an existing analytics event, consent-gated), or the browser-version breakdown in Vercel
   Web Analytics once the account is unblocked. Two weeks of traffic, split by country.
2. Rule: below **0.5 %** of sessions in every target country → raise the targets to `Chrome >= 111`,
   `Safari >= 16.2`, `Firefox >= 113`. Above → keep them.
3. When raising them, keep a minimal readable experience for older browsers (system colours are acceptable),
   and re-run the visual checks on the home page, PDP and checkout.
