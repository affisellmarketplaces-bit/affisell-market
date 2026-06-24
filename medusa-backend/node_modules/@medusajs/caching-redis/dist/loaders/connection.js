"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
exports.default = async ({ container, logger, options, }, moduleDeclaration) => {
    const logger_ = logger || console;
    const moduleOptions = (options ??
        moduleDeclaration?.options ??
        {});
    const { redisUrl, ...redisOptions_ } = moduleOptions;
    if (!redisUrl) {
        throw new Error("[caching-redis] redisUrl is required");
    }
    let redisClient;
    const redisOptions = {
        connectTimeout: 10000,
        commandTimeout: 5000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        connectionName: "medusa-cache-redis",
        ...redisOptions_,
    };
    redisClient = new ioredis_1.default(redisUrl, redisOptions);
    // Handle connection errors gracefully
    redisClient.on("error", (error) => {
        logger_.warn(`Redis cache connection error: ${error.message}`);
    });
    redisClient.on("connect", () => {
        logger_.info("Redis cache connection established successfully");
    });
    redisClient.on("ready", () => {
        logger_.info("Redis cache is ready to accept commands");
    });
    redisClient.on("close", () => {
        logger_.warn("Redis cache connection closed");
    });
    redisClient.on("reconnecting", () => {
        logger_.info("Redis cache attempting to reconnect...");
    });
    try {
        // Test connection with timeout
        await redisClient.ping();
        logger_.info("Redis cache connection test successful");
    }
    catch (error) {
        logger_.warn(`Redis cache connection test failed: ${error.message}, but continuing with lazy connection`);
    }
    container.register({
        redisClient: {
            resolve: () => redisClient,
        },
        prefix: {
            resolve: () => moduleOptions.prefix ?? "mc:",
        },
        logger: {
            resolve: () => logger_,
        },
    });
};
//# sourceMappingURL=connection.js.map