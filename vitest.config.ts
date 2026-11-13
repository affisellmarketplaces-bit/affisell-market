import path from "node:path"
import { defineConfig } from "vitest/config"

import { radarLiteralVariant } from "./vitest-env/radar-literal-variant"

export default defineConfig({
  /**
   * Tests only (this file is read by Vitest and by nothing that runs the seed): lets the seed's tests import
   * `scripts/radar-seed-run.ts?lift=<class>` with that class's disabling literal rewritten in memory. See the plugin.
   */
  plugins: [radarLiteralVariant()],
  /** Isolate from repo `.env` (secrets); Vitest/Vite would otherwise load it. */
  envDir: path.resolve(__dirname, "vitest-env"),
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e", "medusa-backend/**"],
    /**
     * `envDir` above only stops VITE from loading `.env`; `@prisma/client` loads it on its own when imported, which put the
     * production DATABASE_URL and the encryption key in front of tests (see vitest-env/no-real-datastores.ts).
     */
    setupFiles: [path.resolve(__dirname, "vitest-env/no-real-datastores.ts")],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "vitest-env/server-only-stub.js"),
    },
  },
})
