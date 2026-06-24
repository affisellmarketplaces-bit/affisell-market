import { Logger } from "@medusajs/framework/types";
import { ModuleCacheManager } from "../module-cache-manager";
import { FileChangeAction } from "../types";
export declare class BaseReloader {
    private readonly cacheManager;
    private readonly logSource;
    private readonly logger;
    constructor(cacheManager: ModuleCacheManager, logSource: string, logger: Logger);
    clearModuleCache(absoluteFilePath: string): void;
    clearParentChildModulesCache(absoluteFilePath: string, reloaders: Array<() => Promise<void>>, reloadResources: (args: {
        logSource: string;
        action: FileChangeAction;
        absoluteFilePath: string;
        keepCache: boolean;
        skipRecovery: boolean;
        logger: Logger;
        rootDirectory: string;
    }) => Promise<void>, skipRecovery: boolean, rootDirectory: string): Promise<void>;
}
//# sourceMappingURL=base.d.ts.map