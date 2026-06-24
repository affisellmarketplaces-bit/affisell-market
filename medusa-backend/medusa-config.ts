import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV ?? "development", process.cwd())

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS ?? "http://localhost:3001,http://localhost:3002",
      adminCors: process.env.ADMIN_CORS ?? "http://localhost:9000,http://localhost:7001",
      authCors: process.env.AUTH_CORS ?? "http://localhost:9000,http://localhost:7001",
      jwtSecret: process.env.JWT_SECRET ?? "supersecret",
      cookieSecret: process.env.COOKIE_SECRET ?? "supersecret",
    },
  },
  admin: {
    path: "/app",
  },
  modules: [
    {
      resolve: "./src/modules/product-try-on",
    },
  ],
})
