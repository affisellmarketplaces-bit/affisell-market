/** @type {import('lighthouse').Config} */
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start -- -p 3000",
      startServerReadyPattern: "Ready|started server on|Local:",
      startServerReadyTimeout: 120000,
      url: ["http://localhost:3000/"],
      numberOfRuns: 1,
      settings: {
        preset: "perf",
        formFactor: "mobile",
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
        },
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 667,
          deviceScaleFactor: 2,
          disabled: false,
        },
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.6 }],
        "categories:accessibility": ["warn", { minScore: 0.88 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 3200 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 4500 }],
        "total-blocking-time": ["warn", { maxNumericValue: 500 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.14 }],
        interactive: ["warn", { maxNumericValue: 5500 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
}
