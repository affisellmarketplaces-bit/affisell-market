import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  /** Isolate from repo `.env` (secrets); Vitest/Vite would otherwise load it. */
  envDir: path.resolve(__dirname, "vitest-env"),
  test: {
    environment: "node",
    /**
     * `next-auth` / `@auth/core` are ESM packages that import `next/server` WITHOUT an extension: Node's own loader cannot
     * resolve that outside Next's bundler. Inlining them lets Vite resolve it, which is what makes the tests that run
     * Affisell's real `lib/auth.ts` on the real library possible (`authjs-flows.test.ts`).
     */
    server: { deps: { inline: [/next-auth/, /@auth\/core/] } },
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
