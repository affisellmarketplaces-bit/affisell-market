import { Logger } from "@medusajs/framework/types";
/**
 * Manages Node.js require cache operations and tracks broken modules
 */
export declare class ModuleCacheManager {
    private readonly logSource;
    constructor(logSource: string);
    private brokenModules;
    /**
     * Check if a module path should be excluded from cache operations
     */
    private shouldExcludePath;
    /**
     * Clear cache for descendant modules recursively
     */
    private clearDescendantModules;
    /**
     * Clear cache for parent modules recursively
     */
    private clearParentModules;
    /**
     * Find all parent modules that depend on the target path
     */
    private findParentModules;
    /**
     * Log cache clearing operation
     */
    private logCacheClear;
    /**
     * Clear require cache for a file and all its parent/descendant modules
     */
    clear(filePath: string, logger?: Logger, onClear?: (modulePath: string) => Promise<void>, trackBroken?: boolean): Promise<number>;
    /**
     * Remove a module from the broken modules set
     */
    removeBrokenModule(modulePath: string): void;
    /**
     * Get all broken module paths
     */
    getBrokenModules(): string[];
    /**
     * Get the count of broken modules
     */
    getBrokenModuleCount(): number;
    /**
     * Clear a specific module from require cache
     */
    clearSingleModule(modulePath: string): void;
}
//# sourceMappingURL=module-cache-manager.d.ts.map