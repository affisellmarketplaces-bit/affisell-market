import { Logger } from "@medusajs/framework/types";
import { ModuleCacheManager } from "../module-cache-manager";
import { ResourceRegistry } from "../resource-registry";
import { DevServerGlobals, ReloadParams, FileChangeAction } from "../types";
import { BaseReloader } from "./base";
/**
 * Handles hot reloading of workflow and step files
 */
export declare class WorkflowReloader extends BaseReloader {
    #private;
    private workflowManager;
    private registry;
    private reloadResources;
    constructor(workflowManager: DevServerGlobals["WorkflowManager"], cacheManager: ModuleCacheManager, registry: ResourceRegistry, reloadResources: (params: ReloadParams) => Promise<void>, logSource: string, logger: Logger, rootDirectory: string);
    /**
     * Check if a file path represents a workflow
     */
    private isWorkflowPath;
    /**
     * Reload a workflow file if necessary
     */
    reload(action: FileChangeAction, absoluteFilePath: string, keepCache?: boolean, skipRecovery?: boolean): Promise<void>;
    /**
     * Unregister workflow and step resources
     */
    private unregisterResources;
    /**
     * Handle unregistering a step and find affected workflows
     */
    private handleStepUnregister;
    /**
     * Unregister workflows found in a resource and track their paths
     */
    private unregisterWorkflowsInResource;
    /**
     * Reload workflow modules using require
     */
    private reloadWorkflowModules;
}
//# sourceMappingURL=workflows.d.ts.map