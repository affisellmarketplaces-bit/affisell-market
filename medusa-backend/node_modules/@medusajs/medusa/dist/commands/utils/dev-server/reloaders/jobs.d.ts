import { Logger, MedusaContainer } from "@medusajs/framework/types";
import { ModuleCacheManager } from "../module-cache-manager";
import { ResourceRegistry } from "../resource-registry";
import { DevServerGlobals, FileChangeAction } from "../types";
import { BaseReloader } from "./base";
export declare class JobReloader extends BaseReloader {
    #private;
    private workflowManager;
    private container;
    private registry;
    constructor(workflowManager: DevServerGlobals["WorkflowManager"], cacheManager: ModuleCacheManager, container: MedusaContainer, registry: ResourceRegistry, logSource: string, logger: Logger);
    /**
     * Check if a file path represents a subscriber
     */
    private isJobPath;
    /**
     * Unregister a subscriber from the event-bus
     */
    private unregisterJob;
    /**
     * Register a subscriber by loading the file and extracting its metadata
     */
    private registerJob;
    /**
     * Reload a subscriber file if necessary
     */
    reload(action: FileChangeAction, absoluteFilePath: string): Promise<void>;
}
//# sourceMappingURL=jobs.d.ts.map