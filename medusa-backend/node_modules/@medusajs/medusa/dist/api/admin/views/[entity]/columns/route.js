"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Get available columns for an entity.
 *
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const GET = async (req, res) => {
    const entity = req.params.entity;
    const settingsService = req.scope.resolve(utils_1.Modules.SETTINGS);
    if (!settingsService.isEntityDiscoveryInitialized()) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.UNEXPECTED_STATE, "Entity discovery has not been initialized. Please ensure the application has fully started.");
    }
    if (!settingsService.hasEntity(entity)) {
        const availableEntities = settingsService.listDiscoverableEntities();
        const entityNames = availableEntities.map((e) => e.pluralName).slice(0, 10);
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Unsupported entity: ${entity}. Available entities include: ${entityNames.join(", ")}${availableEntities.length > 10 ? "..." : ""}`);
    }
    const columns = await settingsService.generateEntityColumns(entity);
    if (!columns) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.UNEXPECTED_STATE, `Failed to generate columns for entity: ${entity}`);
    }
    return res.json({
        columns,
    });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map