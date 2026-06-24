"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceRegistry = void 0;
const utils_1 = require("@medusajs/framework/utils");
class ResourceRegistry {
    /**
     * Get resources registered for a given file path
     */
    getResources(filePath) {
        return utils_1.globalDevServerRegistry.get(filePath);
    }
    /**
     * Get workflow source paths for a step resource
     */
    getWorkflowSourcePaths(stepId) {
        return utils_1.inverseDevServerRegistry.get(`step:${stepId}`);
    }
}
exports.ResourceRegistry = ResourceRegistry;
//# sourceMappingURL=resource-registry.js.map