import { ApiLoader } from "@medusajs/framework";
import { Logger } from "@medusajs/framework/types";
import { FileChangeAction } from "../types";
import { ModuleCacheManager } from "../module-cache-manager";
import { BaseReloader } from "./base";
/**
 * Handles hot reloading of API resources (routes, middlewares, validators, etc.)
 */
export declare class RouteReloader extends BaseReloader {
    #private;
    private apiLoader;
    constructor(apiLoader: ApiLoader | undefined, cacheManager: ModuleCacheManager, logSource: string, logger: Logger);
    /**
     * Check if a file path is in the API directory
     */
    private isApiPath;
    /**
     * Reload ALL API resources when any API file changes
     * This clears all Express routes/middleware and reloads everything from scratch
     */
    reload(_action: FileChangeAction, absoluteFilePath: string): Promise<void>;
}
//# sourceMappingURL=routes.d.ts.map