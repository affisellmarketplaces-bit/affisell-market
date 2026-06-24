"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseReloader = void 0;
class BaseReloader {
    constructor(cacheManager, logSource, logger) {
        this.cacheManager = cacheManager;
        this.logSource = logSource;
        this.logger = logger;
    }
    clearModuleCache(absoluteFilePath) {
        const resolved = require.resolve(absoluteFilePath);
        if (require.cache[resolved]) {
            delete require.cache[resolved];
        }
    }
    async clearParentChildModulesCache(absoluteFilePath, reloaders, reloadResources, skipRecovery, rootDirectory) {
        await this.cacheManager.clear(absoluteFilePath, this.logger, async (modulePath) => {
            // Create deferred reloader for each cleared module
            reloaders.push(async () => reloadResources({
                logSource: this.logSource,
                action: "change",
                absoluteFilePath: modulePath,
                keepCache: true,
                skipRecovery: true, // handled by the main caller
                logger: this.logger,
                rootDirectory,
            }));
        }, !skipRecovery // Track broken modules unless we're in recovery mode
        );
    }
}
exports.BaseReloader = BaseReloader;
//# sourceMappingURL=base.js.map