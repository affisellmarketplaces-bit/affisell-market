/**
 * Mobile Lighthouse budgets — calibrated from CI run 28877945993 (Jul 2026, 3-run median).
 * perf 0.62, FCP 1527ms, LCP 7974ms, TBT 259ms, CLS 0.175.
 * `warn` = regression vs improved baseline; `error` = severe only.
 */
module.exports = {
  warn: {
    "categories:performance": { minScore: 0.58 },
    "first-contentful-paint": { maxNumericValue: 2000 },
    "largest-contentful-paint": { maxNumericValue: 6500 },
    "total-blocking-time": { maxNumericValue: 450 },
    "cumulative-layout-shift": { maxNumericValue: 0.2 },
    interactive: { maxNumericValue: 8000 },
  },
  error: {
    "categories:performance": { minScore: 0.45 },
    "largest-contentful-paint": { maxNumericValue: 9000 },
    "total-blocking-time": { maxNumericValue: 1200 },
  },
}
