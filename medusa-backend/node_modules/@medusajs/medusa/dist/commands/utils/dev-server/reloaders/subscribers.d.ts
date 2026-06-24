import { Logger, MedusaContainer } from "@medusajs/framework/types";
import { ResourceRegistry } from "../resource-registry";
import { FileChangeAction } from "../types";
import { BaseReloader } from "./base";
import { ModuleCacheManager } from "../module-cache-manager";
/**
 * Handles hot reloading of subscriber files with event-bus unregistration
 */
export declare class SubscriberReloader extends BaseReloader {
    #private;
    private container;
    private registry;
    constructor(container: MedusaContainer, cacheManager: ModuleCacheManager, registry: ResourceRegistry, logSource: string, logger: Logger);
    /**
     * Check if a file path represents a subscriber
     */
    private isSubscriberPath;
    /**
     * Unregister a subscriber from the event-bus
     */
    private unregisterSubscriber;
    /**
     * Register a subscriber by loading the file and extracting its metadata
     */
    private registerSubscriber;
    /**
     * Reload a subscriber file if necessary
     */
    reload(action: FileChangeAction, absoluteFilePath: string): Promise<void>;
}
//# sourceMappingURL=subscribers.d.ts.map