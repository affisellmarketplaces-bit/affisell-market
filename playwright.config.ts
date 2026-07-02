import { resolve } from "node:path"

import { defineConfig, devices } from "@playwright/test"
import { config as loadEnv } from "dotenv"

for (const name of [".env", ".env.local"]) {
  loadEnv({ path: resolve(process.cwd(), name), override: name === ".env.local" })
}

const devPort = process.env.PORT ?? "3001"
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${devPort}`
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1"

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: skipWebServer
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          /** Dev script skips port scan so `url` matches `baseURL` (default 3001). */
          PLAYWRIGHT_WEB_SERVER: "1",
          E2E_PULSE_FIXTURES: "1",
          /** Affiliate onboarding e2e: inherit DEMO_LAB_PASSWORD from shell / .env.local */
          PORT: devPort,
        },
      },
})
