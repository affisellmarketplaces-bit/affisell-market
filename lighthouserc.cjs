/** @type {import('lighthouse').Config} */
const budgets = require("./lighthouse-budgets.cjs")

function toAssertions(level) {
  const source = budgets[level]
  const assertions = {}
  for (const [id, rule] of Object.entries(source)) {
    if ("minScore" in rule) assertions[id] = [level, { minScore: rule.minScore }]
    if ("maxNumericValue" in rule) assertions[id] = [level, { maxNumericValue: rule.maxNumericValue }]
  }
  return assertions
}

module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start -- -p 3000",
      startServerReadyPattern: "Ready|started server on|Local:",
      startServerReadyTimeout: 120000,
      url: ["http://localhost:3000/"],
      numberOfRuns: 1,
      settings: {
        onlyCategories: ["performance"],
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
        ...toAssertions("warn"),
        ...toAssertions("error"),
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
}
