/** @type {import('lighthouse').Config} */
const budgets = require("./lighthouse-budgets.cjs")

/** Must match scripts/dev-localhost-url.mjs DEFAULT_DEV_PORT (3001). */
const DEV_PORT = 3001
const DEV_ORIGIN = `http://localhost:${DEV_PORT}`

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
      startServerCommand: `npm run start -- -p ${DEV_PORT}`,
      startServerReadyPattern: "Ready|started server on|Local:",
      startServerReadyTimeout: 120000,
      url: [`${DEV_ORIGIN}/`],
      numberOfRuns: 3,
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
