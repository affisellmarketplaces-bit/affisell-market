/**
 * Mobile Lighthouse budgets — calibrated from CI baseline (run 28874522230, Jul 2026).
 * `warn` = regression vs baseline; `error` = severe regression only.
 */
module.exports = {
  warn: {
    "categories:performance": { minScore: 0.38 },
    "first-contentful-paint": { maxNumericValue: 3600 },
    "largest-contentful-paint": { maxNumericValue: 5000 },
    "total-blocking-time": { maxNumericValue: 1400 },
    "cumulative-layout-shift": { maxNumericValue: 0.22 },
    interactive: { maxNumericValue: 9500 },
  },
  error: {
    "categories:performance": { minScore: 0.32 },
    "largest-contentful-paint": { maxNumericValue: 6000 },
    "total-blocking-time": { maxNumericValue: 2000 },
  },
}
