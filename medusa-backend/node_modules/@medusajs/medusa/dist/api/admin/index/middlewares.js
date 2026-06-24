"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminIndexRoutesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const index_engine_1 = __importDefault(require("../../../feature-flags/index-engine"));
const authenticate_middleware_1 = require("../../../utils/middlewares/authenticate-middleware");
const validator_1 = require("./validator");
const isIndexEnabledMiddleware = (req, res, next) => {
    const indexService = req.scope.resolve(utils_1.Modules.INDEX, {
        allowUnregistered: true,
    });
    const logger = req.scope.resolve(utils_1.ContainerRegistrationKeys.LOGGER, {
        allowUnregistered: true,
    }) ?? console;
    if (!indexService ||
        !utils_1.FeatureFlag.isFeatureEnabled(index_engine_1.default.key)) {
        logger.warn("Trying to access '/admin/index/*' route but the index module is not configured");
        return res.status(404);
    }
    return next();
};
exports.adminIndexRoutesMiddlewares = [
    {
        method: ["GET"],
        matcher: "/admin/index/details",
        middlewares: [
            (0, authenticate_middleware_1.authenticate)("user", ["session", "bearer", "api-key"]),
            isIndexEnabledMiddleware,
        ],
    },
    {
        method: ["POST"],
        matcher: "/admin/index/sync",
        middlewares: [
            (0, authenticate_middleware_1.authenticate)("user", ["session", "bearer", "api-key"]),
            isIndexEnabledMiddleware,
            (0, framework_1.validateAndTransformBody)(validator_1.AdminIndexSyncPayload),
        ],
    },
];
//# sourceMappingURL=middlewares.js.map