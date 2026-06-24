"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureViewConfigurationsEnabled = void 0;
const utils_1 = require("@medusajs/framework/utils");
const view_configurations_1 = __importDefault(require("../../../../../feature-flags/view-configurations"));
const ensureViewConfigurationsEnabled = async (req, res, next) => {
    const flagRouter = req.scope.resolve(utils_1.ContainerRegistrationKeys.FEATURE_FLAG_ROUTER);
    if (!flagRouter.isFeatureEnabled(view_configurations_1.default.key)) {
        res.status(404).json({
            type: "not_found",
            message: "Route not found",
        });
        return;
    }
    next();
};
exports.ensureViewConfigurationsEnabled = ensureViewConfigurationsEnabled;
//# sourceMappingURL=middleware.js.map