import type { ICachingModuleService, ICachingStrategy, Logger } from "@medusajs/framework/types";
import { InjectedDependencies } from "../types";
import CacheProviderService from "./cache-provider";
export default class CachingModuleService implements ICachingModuleService {
    protected readonly moduleDeclaration: {
        options: {
            ttl?: number;
        };
    } | {
        ttl?: number;
    };
    protected container: InjectedDependencies;
    protected providerService: CacheProviderService;
    protected strategyCtr: new (...args: any[]) => ICachingStrategy;
    protected strategy: ICachingStrategy;
    protected defaultProviderId: string;
    protected logger: Logger;
    protected ongoingRequests: Map<string, Promise<any>>;
    protected ttl: number;
    static traceGet?: (cacheGetFn: () => Promise<any>, key: string, tags: string[]) => Promise<any>;
    static traceSet?: (cacheSetFn: () => Promise<any>, key: string, tags: string[], options: {
        autoInvalidate?: boolean;
    }) => Promise<any>;
    static traceClear?: (cacheClearFn: () => Promise<any>, key: string, tags: string[], options: {
        autoInvalidate?: boolean;
    }) => Promise<any>;
    constructor(container: InjectedDependencies, moduleDeclaration: {
        options: {
            ttl?: number;
        };
    } | {
        ttl?: number;
    });
    __hooks: {
        onApplicationStart: () => Promise<void>;
        onApplicationShutdown: () => Promise<void>;
        onApplicationPrepareShutdown: () => Promise<void>;
    };
    protected onApplicationStart(): void;
    protected onApplicationShutdown(): void;
    protected onApplicationPrepareShutdown(): void;
    protected static normalizeProviders(providers: string[] | {
        id: string;
        ttl?: number;
    }[]): {
        id: string;
        ttl?: number;
    }[];
    protected getRequestKey(key?: string, tags?: string[], providers?: string[]): string;
    protected getClearRequestKey(key?: string, tags?: string[], providers?: string[]): string;
    get(options: {
        key?: string;
        tags?: string[];
        providers?: string[];
    }): Promise<any>;
    private get_;
    protected performCacheGet(key?: string, tags?: string[], providers?: string[]): Promise<any>;
    set(options: {
        key: string;
        data: object;
        ttl?: number;
        tags?: string[];
        providers?: string[];
        options?: {
            autoInvalidate?: boolean;
        };
    }): Promise<any>;
    private set_;
    protected performCacheSet(key: string, tags: string[], data: object, ttl?: number, providers?: {
        id: string;
        ttl?: number;
    }[], options?: {
        autoInvalidate?: boolean;
    }): Promise<void>;
    clear(options: {
        key?: string;
        tags?: string[];
        options?: {
            autoInvalidate?: boolean;
        };
        providers?: string[];
    }): Promise<any>;
    private clear_;
    protected performCacheClear(key?: string, tags?: string[], options?: {
        autoInvalidate?: boolean;
    }, providers?: string[]): Promise<void>;
    computeKey(input: object): Promise<string>;
    computeTags(input: object, options?: Record<string, any>): Promise<string[]>;
}
//# sourceMappingURL=cache-module.d.ts.map