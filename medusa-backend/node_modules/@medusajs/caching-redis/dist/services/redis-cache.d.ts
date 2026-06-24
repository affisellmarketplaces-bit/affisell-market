import { Logger } from "@medusajs/framework/types";
import { RedisCacheModuleOptions } from "../types";
import { Redis } from "ioredis";
export declare class RedisCachingProvider {
    #private;
    static identifier: string;
    protected redisClient: Redis;
    protected keyNamePrefix: string;
    protected defaultTTL: number;
    protected compressionThreshold: number;
    protected hasher: (key: string) => string;
    protected logger: Logger;
    constructor({ redisClient, logger, prefix, hasher, }: {
        redisClient: Redis;
        prefix: string;
        hasher: (key: string) => string;
        logger: Logger;
    }, options?: RedisCacheModuleOptions);
    private isConnectionError;
    private isConnectionHealthy;
    get({ key, tags }: {
        key?: string;
        tags?: string[];
    }): Promise<any>;
    set({ key, data, ttl, tags, options, }: {
        key: string;
        data: object;
        ttl?: number;
        tags?: string[];
        options?: {
            autoInvalidate?: boolean;
        };
    }): Promise<void>;
    clear({ key, tags, options, }: {
        key?: string;
        tags?: string[];
        options?: {
            autoInvalidate?: boolean;
        };
    }): Promise<void>;
    flush(): Promise<void>;
}
//# sourceMappingURL=redis-cache.d.ts.map