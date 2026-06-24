"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Get the index information for all entities that are indexed and their sync state
 *
 * @since 2.11.2
 * @featureFlag index
 */
const GET = async (req, res) => {
    const indexModuleService = req.scope.resolve(utils_1.Modules.INDEX);
    const indexInfo = await indexModuleService.getInfo();
    res.json({
        metadata: indexInfo,
    });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map