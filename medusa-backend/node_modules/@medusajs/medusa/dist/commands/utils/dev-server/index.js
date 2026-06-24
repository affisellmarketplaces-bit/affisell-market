"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reloadResources = reloadResources;
const framework_1 = require("@medusajs/framework");
const logger_1 = require("@medusajs/framework/logger");
const module_cache_manager_1 = require("./module-cache-manager");
const recovery_service_1 = require("./recovery-service");
const routes_1 = require("./reloaders/routes");
const subscribers_1 = require("./reloaders/subscribers");
const workflows_1 = require("./reloaders/workflows");
const resource_registry_1 = require("./resource-registry");
const jobs_1 = require("./reloaders/jobs");
const modules_1 = require("./reloaders/modules");
const errors_1 = require("./errors");
let sharedCacheManager;
const sharedRegistry = new resource_registry_1.ResourceRegistry();
const reloaders = {};
function initializeReloaders(logSource, rootDirectory) {
    sharedCacheManager ??= new module_cache_manager_1.ModuleCacheManager(logSource);
    const globals = global;
    if (!reloaders.routesReloader) {
        const routeReloader = new routes_1.RouteReloader(globals.__MEDUSA_HMR_API_LOADER__, sharedCacheManager, logSource, logger_1.logger);
        reloaders.routesReloader = routeReloader;
    }
    if (!reloaders.subscribersReloader) {
        const subscriberReloader = new subscribers_1.SubscriberReloader(framework_1.container, sharedCacheManager, sharedRegistry, logSource, logger_1.logger);
        reloaders.subscribersReloader = subscriberReloader;
    }
    if (!reloaders.workflowsReloader) {
        const workflowReloader = new workflows_1.WorkflowReloader(globals.WorkflowManager, sharedCacheManager, sharedRegistry, reloadResources, logSource, logger_1.logger, rootDirectory);
        reloaders.workflowsReloader = workflowReloader;
    }
    if (!reloaders.jobsReloader) {
        const jobReloader = new jobs_1.JobReloader(globals.WorkflowManager, sharedCacheManager, framework_1.container, sharedRegistry, logSource, logger_1.logger);
        reloaders.jobsReloader = jobReloader;
    }
    if (!reloaders.modulesReloader) {
        const moduleReloader = new modules_1.ModuleReloader(sharedCacheManager, rootDirectory, logSource, logger_1.logger);
        reloaders.modulesReloader = moduleReloader;
    }
}
const unmanagedFiles = ["medusa-config", ".env"];
/**
 * Main entry point for reloading resources (routes, subscribers, workflows, and modules)
 * Orchestrates the reload process and handles recovery of broken modules
 */
async function reloadResources({ logSource, action, absoluteFilePath, keepCache, logger, skipRecovery = false, rootDirectory, }) {
    if (unmanagedFiles.some((file) => absoluteFilePath.includes(file))) {
        throw new errors_1.HMRReloadError(`File ${absoluteFilePath} is not managed by the dev server HMR. Server restart may be required.`);
    }
    initializeReloaders(logSource, rootDirectory);
    // Reload modules first as other resources might depend on them
    await reloaders.modulesReloader?.reload?.(action, absoluteFilePath);
    // Reload in dependency order: workflows → routes → subscribers → jobs
    // Jobs depend on workflows, so workflows must be reloaded first
    await reloaders.workflowsReloader.reload(action, absoluteFilePath, keepCache, skipRecovery);
    await reloaders.routesReloader.reload(action, absoluteFilePath);
    await reloaders.subscribersReloader?.reload?.(action, absoluteFilePath);
    await reloaders.jobsReloader?.reload?.(action, absoluteFilePath);
    // Attempt recovery of broken modules (unless we're already in recovery mode)
    if (!skipRecovery) {
        const recoveryService = new recovery_service_1.RecoveryService(sharedCacheManager, reloadResources, logSource, logger, rootDirectory);
        await recoveryService.recoverBrokenModules();
    }
}
//# sourceMappingURL=index.js.map