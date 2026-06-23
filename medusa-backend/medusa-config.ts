import { loadEnv, defineConfig, Modules } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV ?? "development", process.cwd())

const redisUrl = process.env.REDIS_URL?.trim()

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: redisUrl || undefined,
    http: {
      storeCors: process.env.STORE_CORS ?? "http://localhost:3001,http://localhost:3002",
      adminCors: process.env.ADMIN_CORS ?? "http://localhost:9000,http://localhost:7001",
      authCors: process.env.AUTH_CORS ?? "http://localhost:9000,http://localhost:7001",
      jwtSecret: process.env.JWT_SECRET ?? "supersecret",
      cookieSecret: process.env.COOKIE_SECRET ?? "supersecret",
    },
  },
  modules: [
    ...(redisUrl
      ? [
          {
            resolve: "@medusajs/cache-redis",
            options: { redisUrl, ttl: 60 },
          },
          {
            resolve: "@medusajs/event-bus-redis",
            options: { redisUrl },
          },
          {
            resolve: "@medusajs/workflow-engine-redis",
            options: { redisUrl },
          },
        ]
      : []),
    {
      resolve: "./src/modules/product-try-on",
    },
  ],
})
