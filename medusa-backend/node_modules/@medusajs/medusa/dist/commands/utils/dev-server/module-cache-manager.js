"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleCacheManager = void 0;
const path_1 = __importDefault(require("path"));
const types_1 = require("./types");
/**
 * Manages Node.js require cache operations and tracks broken modules
 */
class ModuleCacheManager {
    constructor(logSource) {
        this.logSource = logSource;
        this.brokenModules = new Set();
    }
    /**
     * Check if a module path should be excluded from cache operations
     */
    shouldExcludePath(modulePath) {
        return types_1.CONFIG.EXCLUDED_PATH_PATTERNS.some((pattern) => modulePath.includes(pattern));
    }
    /**
     * Clear cache for descendant modules recursively
     */
    async clearDescendantModules(modulePath, visitedModules, logger, onClear) {
        if (this.shouldExcludePath(modulePath) || visitedModules.has(modulePath)) {
            return;
        }
        visitedModules.add(modulePath);
        const moduleEntry = require.cache[modulePath];
        if (!moduleEntry) {
            return;
        }
        // Recursively clear children first
        if (moduleEntry.children) {
            for (const child of moduleEntry.children) {
                await this.clearDescendantModules(child.id, visitedModules, logger, onClear);
            }
        }
        delete require.cache[modulePath];
        if (onClear) {
            await onClear(modulePath);
        }
        this.logCacheClear(modulePath, logger, "Cleared cache");
    }
    /**
     * Clear cache for parent modules recursively
     */
    async clearParentModules(targetPath, visitedModules, logger, onClear, trackBroken = true) {
        const parentsToCheck = this.findParentModules(targetPath);
        for (const modulePath of parentsToCheck) {
            if (visitedModules.has(modulePath)) {
                continue;
            }
            visitedModules.add(modulePath);
            // Recursively clear parents first
            await this.clearParentModules(modulePath, visitedModules, logger, onClear, trackBroken);
            // Track as potentially broken before deletion
            if (trackBroken) {
                this.brokenModules.add(modulePath);
            }
            delete require.cache[modulePath];
            if (onClear) {
                await onClear(modulePath);
            }
            this.logCacheClear(modulePath, logger, "Cleared parent cache");
        }
    }
    /**
     * Find all parent modules that depend on the target path
     */
    findParentModules(targetPath) {
        const parents = new Set();
        for (const [modulePath, moduleEntry] of Object.entries(require.cache)) {
            if (this.shouldExcludePath(modulePath)) {
                continue;
            }
            if (moduleEntry?.children?.some((child) => child.id === targetPath)) {
                parents.add(modulePath);
            }
        }
        return parents;
    }
    /**
     * Log cache clearing operation
     */
    logCacheClear(modulePath, logger, message) {
        if (logger) {
            const relativePath = path_1.default.relative(process.cwd(), modulePath);
            logger.debug(`${this.logSource} ${message}: ${relativePath}`);
        }
    }
    /**
     * Clear require cache for a file and all its parent/descendant modules
     */
    async clear(filePath, logger, onClear, trackBroken = true) {
        const absolutePath = path_1.default.resolve(filePath);
        const visitedModules = new Set();
        // Clear parents first, then descendants
        await this.clearParentModules(absolutePath, visitedModules, logger, onClear, trackBroken);
        await this.clearDescendantModules(absolutePath, visitedModules, logger, onClear);
        if (logger) {
            const relativePath = path_1.default.relative(process.cwd(), filePath);
            logger.info(`${this.logSource} Cleared ${visitedModules.size} module(s) from cache for ${relativePath}`);
        }
        return visitedModules.size;
    }
    /**
     * Remove a module from the broken modules set
     */
    removeBrokenModule(modulePath) {
        this.brokenModules.delete(modulePath);
    }
    /**
     * Get all broken module paths
     */
    getBrokenModules() {
        return Array.from(this.brokenModules);
    }
    /**
     * Get the count of broken modules
     */
    getBrokenModuleCount() {
        return this.brokenModules.size;
    }
    /**
     * Clear a specific module from require cache
     */
    clearSingleModule(modulePath) {
        delete require.cache[modulePath];
    }
}
exports.ModuleCacheManager = ModuleCacheManager;
//# sourceMappingURL=module-cache-manager.js.map