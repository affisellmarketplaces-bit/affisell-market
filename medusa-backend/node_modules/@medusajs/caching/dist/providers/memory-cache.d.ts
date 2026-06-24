import NodeCache from "node-cache";
import type { ICachingProviderService, Logger } from "@medusajs/framework/types";
import { MemoryCacheModuleOptions } from "../types";
export declare class MemoryCachingProvider implements ICachingProviderService {
    static identifier: string;
    protected logger: Logger;
    protected cacheClient: NodeCache;
    protected tagIndex: Map<string, Set<string>>;
    protected keyTags: Map<string, Set<string>>;
    protected entryOptions: Map<string, {
        autoInvalidate?: boolean;
    }>;
    protected keySizes: Map<string, number>;
    protected approximateMemoryUsage: number;
    protected options: MemoryCacheModuleOptions;
    protected maxSize: number;
    protected hasher: (key: string) => string;
    constructor({ logger, hasher }: {
        logger?: Logger;
        hasher: (key: string) => string;
    }, options?: MemoryCacheModuleOptions);
    private calculateEntrySize;
    private cleanupTagReferences;
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
}
//# sourceMappingURL=memory-cache.d.ts.map