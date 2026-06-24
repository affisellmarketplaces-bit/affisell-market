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
var _WorkflowReloader_logSource, _WorkflowReloader_logger, _WorkflowReloader_rootDirectory;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowReloader = void 0;
const types_1 = require("../types");
const base_1 = require("./base");
/**
 * Handles hot reloading of workflow and step files
 */
class WorkflowReloader extends base_1.BaseReloader {
    constructor(workflowManager, cacheManager, registry, reloadResources, logSource, logger, rootDirectory) {
        super(cacheManager, logSource, logger);
        this.workflowManager = workflowManager;
        this.registry = registry;
        this.reloadResources = reloadResources;
        _WorkflowReloader_logSource.set(this, void 0);
        _WorkflowReloader_logger.set(this, void 0);
        _WorkflowReloader_rootDirectory.set(this, void 0);
        __classPrivateFieldSet(this, _WorkflowReloader_logSource, logSource, "f");
        __classPrivateFieldSet(this, _WorkflowReloader_logger, logger, "f");
        __classPrivateFieldSet(this, _WorkflowReloader_rootDirectory, rootDirectory, "f");
    }
    /**
     * Check if a file path represents a workflow
     */
    isWorkflowPath(filePath) {
        return filePath.includes(types_1.CONFIG.RESOURCE_PATH_PATTERNS.workflow);
    }
    /**
     * Reload a workflow file if necessary
     */
    async reload(action, absoluteFilePath, keepCache = false, skipRecovery = false) {
        if (!this.isWorkflowPath(absoluteFilePath)) {
            return;
        }
        if (!this.workflowManager) {
            __classPrivateFieldGet(this, _WorkflowReloader_logger, "f").error(`${__classPrivateFieldGet(this, _WorkflowReloader_logSource, "f")} WorkflowManager not available - cannot reload workflows`);
            return;
        }
        const requirableWorkflowPaths = new Set();
        const reloaders = [];
        // Unregister resources and collect affected workflows
        this.unregisterResources(absoluteFilePath, requirableWorkflowPaths);
        if (!keepCache) {
            await this.clearParentChildModulesCache(absoluteFilePath, reloaders, this.reloadResources, skipRecovery, __classPrivateFieldGet(this, _WorkflowReloader_rootDirectory, "f"));
        }
        this.clearModuleCache(absoluteFilePath);
        // Reload workflows that were affected
        if (action !== "unlink") {
            this.reloadWorkflowModules(requirableWorkflowPaths, absoluteFilePath);
        }
        // Execute deferred reloaders
        if (reloaders.length) {
            await Promise.all(reloaders.map(async (reloader) => reloader()));
        }
    }
    /**
     * Unregister workflow and step resources
     */
    unregisterResources(absoluteFilePath, affectedWorkflows) {
        const resources = this.registry.getResources(absoluteFilePath);
        if (!resources) {
            return;
        }
        for (const [type, resourceList] of resources.entries()) {
            for (const resource of resourceList) {
                if (type === "workflow") {
                    this.workflowManager.unregister(resource.id);
                }
                else if (type === "step") {
                    this.handleStepUnregister(resource, affectedWorkflows);
                }
            }
        }
    }
    /**
     * Handle unregistering a step and find affected workflows
     */
    handleStepUnregister(stepResource, affectedWorkflows) {
        const workflowSourcePaths = this.registry.getWorkflowSourcePaths(stepResource.id);
        if (!workflowSourcePaths) {
            return;
        }
        for (const sourcePath of workflowSourcePaths) {
            const workflowResources = this.registry.getResources(sourcePath);
            if (!workflowResources) {
                continue;
            }
            this.unregisterWorkflowsInResource(workflowResources, affectedWorkflows, sourcePath);
        }
    }
    /**
     * Unregister workflows found in a resource and track their paths
     */
    unregisterWorkflowsInResource(workflowResources, affectedWorkflows, sourcePath) {
        for (const [type, resourceList] of workflowResources.entries()) {
            if (type !== "workflow") {
                continue;
            }
            for (const workflow of resourceList) {
                this.workflowManager.unregister(workflow.id);
                affectedWorkflows.add(sourcePath);
            }
        }
    }
    /**
     * Reload workflow modules using require
     */
    reloadWorkflowModules(workflowPaths, mainFilePath) {
        for (const workflowPath of workflowPaths) {
            require(workflowPath);
        }
        require(mainFilePath);
    }
}
exports.WorkflowReloader = WorkflowReloader;
_WorkflowReloader_logSource = new WeakMap(), _WorkflowReloader_logger = new WeakMap(), _WorkflowReloader_rootDirectory = new WeakMap();
//# sourceMappingURL=workflows.js.map