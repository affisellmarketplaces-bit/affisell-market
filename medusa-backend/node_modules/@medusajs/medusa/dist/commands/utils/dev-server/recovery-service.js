"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryService = void 0;
const path_1 = __importDefault(require("path"));
/**
 * Handles recovery of broken modules after dependencies are restored
 */
class RecoveryService {
    constructor(cacheManager, reloadResources, logSource, logger, rootDirectory) {
        this.cacheManager = cacheManager;
        this.reloadResources = reloadResources;
        this.logSource = logSource;
        this.logger = logger;
        this.rootDirectory = rootDirectory;
    }
    /**
     * Attempt to recover all broken modules
     */
    async recoverBrokenModules() {
        const brokenCount = this.cacheManager.getBrokenModuleCount();
        if (!brokenCount) {
            return;
        }
        this.logger.info(`${this.logSource} Attempting to recover ${brokenCount} broken module(s)`);
        const brokenModules = this.cacheManager.getBrokenModules();
        for (const modulePath of brokenModules) {
            await this.attemptModuleRecovery(modulePath);
        }
        this.logRecoveryResults();
    }
    /**
     * Attempt to recover a single broken module
     */
    async attemptModuleRecovery(modulePath) {
        this.cacheManager.clearSingleModule(modulePath);
        const relativePath = path_1.default.relative(process.cwd(), modulePath);
        this.logger.info(`${this.logSource} Attempting to reload: ${relativePath}`);
        try {
            // Attempt reload with skipRecovery=true to prevent infinite recursion
            await this.reloadResources({
                logSource: this.logSource,
                action: "change",
                absoluteFilePath: modulePath,
                keepCache: false,
                logger: this.logger,
                skipRecovery: true,
                rootDirectory: this.rootDirectory,
            });
            this.cacheManager.removeBrokenModule(modulePath);
            this.logger.info(`${this.logSource} Successfully recovered: ${relativePath}`);
        }
        catch (error) {
            this.logger.debug(`${this.logSource} Could not recover ${relativePath}: ${error}`);
        }
    }
    /**
     * Log final recovery results
     */
    logRecoveryResults() {
        const remainingBroken = this.cacheManager.getBrokenModuleCount();
        if (remainingBroken) {
            this.logger.debug(`${this.logSource} ${remainingBroken} module(s) remain broken. They may recover when additional dependencies are restored.`);
        }
        else {
            this.logger.info(`${this.logSource} All broken modules successfully recovered`);
        }
    }
}
exports.RecoveryService = RecoveryService;
//# sourceMappingURL=recovery-service.js.map