"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _JobReloader_logSource, _JobReloader_logger;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobReloader = void 0;
const jobs_1 = require("@medusajs/framework/jobs");
const types_1 = require("../types");
const base_1 = require("./base");
class JobReloader extends base_1.BaseReloader {
    constructor(workflowManager, cacheManager, container, registry, logSource, logger) {
        super(cacheManager, logSource, logger);
        this.workflowManager = workflowManager;
        this.container = container;
        this.registry = registry;
        _JobReloader_logSource.set(this, void 0);
        _JobReloader_logger.set(this, void 0);
        __classPrivateFieldSet(this, _JobReloader_logSource, logSource, "f");
        __classPrivateFieldSet(this, _JobReloader_logger, logger, "f");
    }
    /**
     * Check if a file path represents a subscriber
     */
    isJobPath(filePath) {
        return filePath.includes(types_1.CONFIG.RESOURCE_PATH_PATTERNS.job);
    }
    /**
     * Unregister a subscriber from the event-bus
     */
    unregisterJob(metadata) {
        this.workflowManager?.unregister(metadata.name);
        __classPrivateFieldGet(this, _JobReloader_logger, "f").debug(`${__classPrivateFieldGet(this, _JobReloader_logSource, "f")} Unregistered job ${metadata.name}`);
    }
    /**
     * Register a subscriber by loading the file and extracting its metadata
     */
    async registerJob(absoluteFilePath) {
        const jobLoader = new jobs_1.JobLoader([], this.container);
        await jobLoader.loadFile(absoluteFilePath);
        __classPrivateFieldGet(this, _JobReloader_logger, "f").debug(`${__classPrivateFieldGet(this, _JobReloader_logSource, "f")} Registered job ${absoluteFilePath}`);
    }
    /**
     * Reload a subscriber file if necessary
     */
    async reload(action, absoluteFilePath) {
        if (!this.isJobPath(absoluteFilePath)) {
            return;
        }
        const existingResources = this.registry.getResources(absoluteFilePath);
        if (existingResources) {
            for (const [_, resources] of existingResources) {
                for (const resource of resources) {
                    this.unregisterJob({
                        name: resource.id,
                        config: resource.config,
                    });
                }
            }
        }
        if (action === "add" || action === "change") {
            this.clearModuleCache(absoluteFilePath);
            await this.registerJob(absoluteFilePath);
        }
    }
}
exports.JobReloader = JobReloader;
_JobReloader_logSource = new WeakMap(), _JobReloader_logger = new WeakMap();
//# sourceMappingURL=jobs.js.map