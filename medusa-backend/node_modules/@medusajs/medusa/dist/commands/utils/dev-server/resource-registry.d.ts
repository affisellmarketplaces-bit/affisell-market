import { ResourceMap, ResourcePath } from "@medusajs/framework/utils";
export declare class ResourceRegistry {
    /**
     * Get resources registered for a given file path
     */
    getResources(filePath: string): ResourceMap | undefined;
    /**
     * Get workflow source paths for a step resource
     */
    getWorkflowSourcePaths(stepId: string): ResourcePath[] | undefined;
}
//# sourceMappingURL=resource-registry.d.ts.map