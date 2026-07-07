/**
 * Mobile Lighthouse budgets — calibrated from CI (Jul 2026, 3-run median).
 * Baseline run 28874522230: perf 0.40, LCP 4590ms, TBT 1252ms.
 * Post-TBT batch run 28876357924: perf 0.46, LCP 7770ms (no DATABASE_URL in CI build).
 * `warn` = regression vs improved baseline; `error` = severe only.
 */
module.exports = {
  warn: {
    "categories:performance": { minScore: 0.42 },
    "first-contentful-paint": { maxNumericValue: 3600 },
    "largest-contentful-paint": { maxNumericValue: 5500 },
    "total-blocking-time": { maxNumericValue: 1300 },
    "cumulative-layout-shift": { maxNumericValue: 0.22 },
    interactive: { maxNumericValue: 9500 },
  },
  error: {
    "categories:performance": { minScore: 0.32 },
    "largest-contentful-paint": { maxNumericValue: 8500 },
    "total-blocking-time": { maxNumericValue: 2000 },
  },
}
