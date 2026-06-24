"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const connection_1 = __importDefault(require("./loaders/connection"));
const hash_1 = __importDefault(require("./loaders/hash"));
const redis_cache_1 = require("./services/redis-cache");
const services = [redis_cache_1.RedisCachingProvider];
const loaders = [connection_1.default, hash_1.default];
exports.default = (0, utils_1.ModuleProvider)(utils_1.Modules.CACHING, {
    services,
    loaders,
});
//# sourceMappingURL=index.js.map