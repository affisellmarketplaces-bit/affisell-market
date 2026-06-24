import { Logger } from "@medusajs/framework/types";
import { ModuleCacheManager } from "../module-cache-manager";
import { FileChangeAction } from "../types";
import { BaseReloader } from "./base";
/**
 * Handles hot reloading of custom modules in the /modules directory
 */
export declare class ModuleReloader extends BaseReloader {
    #private;
    constructor(cacheManager: ModuleCacheManager, rootDirectory: string, logSource: string, logger: Logger);
    /**
     * Check if a file path is within a module directory
     */
    private isModulePath;
    /**
     * Extract module name from file path
     * e.g., "/path/to/project/modules/contact-us/service.ts" -> "contact-us"
     */
    private getModuleNameFromPath;
    /**
     * Get the module directory path
     */
    private getModuleDirectory;
    /**
     * Get module key and service name from config
     */
    private getModuleInfo;
    /**
     * Shutdown a module instance by calling its lifecycle hooks
     */
    private shutdownModule;
    /**
     * Clear all module files from require cache
     */
    private clearModuleFilesCache;
    /**
     * Reload a module when its files change
     */
    reload(action: FileChangeAction, absoluteFilePath: string): Promise<void>;
}
//# sourceMappingURL=modules.d.ts.map