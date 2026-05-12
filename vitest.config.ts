import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  /** Isolate from repo `.env` (secrets); Vitest/Vite would otherwise load it. */
  envDir: path.resolve(__dirname, "vitest-env"),
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
