import { Logger } from "@medusajs/framework/types";
import { ModuleCacheManager } from "./module-cache-manager";
import { ReloadParams } from "./types";
/**
 * Handles recovery of broken modules after dependencies are restored
 */
export declare class RecoveryService {
    private cacheManager;
    private reloadResources;
    private logSource;
    private logger;
    private rootDirectory;
    constructor(cacheManager: ModuleCacheManager, reloadResources: (params: ReloadParams) => Promise<void>, logSource: string, logger: Logger, rootDirectory: string);
    /**
     * Attempt to recover all broken modules
     */
    recoverBrokenModules(): Promise<void>;
    /**
     * Attempt to recover a single broken module
     */
    private attemptModuleRecovery;
    /**
     * Log final recovery results
     */
    private logRecoveryResults;
}
//# sourceMappingURL=recovery-service.d.ts.map