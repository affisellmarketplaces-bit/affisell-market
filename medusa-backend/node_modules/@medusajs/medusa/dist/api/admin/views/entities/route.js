"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * List all available entities that can be used for view configurations.
 * Entities are discovered from joiner configs (GraphQL schema).
 *
 * @since 2.10.3
 * @featureFlag view_configurations
 */
const GET = async (req, res) => {
    const settingsService = req.scope.resolve(utils_1.Modules.SETTINGS);
    const entities = settingsService.listDiscoverableEntities();
    entities.sort((a, b) => a.name.localeCompare(b.name));
    return res.json({
        entities,
    });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map