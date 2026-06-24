"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = exports.AUTHENTICATE = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.AUTHENTICATE = false;
/**
 * @since 2.10.0
 */
const GET = async (req, res) => {
    const featureFlagRouter = req.scope.resolve(utils_1.ContainerRegistrationKeys.FEATURE_FLAG_ROUTER);
    const flags = featureFlagRouter.listFlags();
    // Convert array of flags to a simple key-value object
    const featureFlags = {};
    flags.forEach((flag) => {
        featureFlags[flag.key] = flag.value;
    });
    res.json({ feature_flags: featureFlags });
};
exports.GET = GET;
//# sourceMappingURL=route.js.map