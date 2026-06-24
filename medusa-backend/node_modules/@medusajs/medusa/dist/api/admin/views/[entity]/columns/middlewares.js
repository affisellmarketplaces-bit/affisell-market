"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.columnRoutesMiddlewares = void 0;
const framework_1 = require("@medusajs/framework");
const middleware_1 = require("../configurations/middleware");
const validators_1 = require("./validators");
exports.columnRoutesMiddlewares = [
    // Apply feature flag check to all column routes
    {
        method: ["GET", "POST"],
        matcher: "/admin/views/*/columns",
        middlewares: [middleware_1.ensureViewConfigurationsEnabled],
    },
    {
        method: ["GET"],
        matcher: "/admin/views/:entity/columns",
        middlewares: [
            middleware_1.ensureViewConfigurationsEnabled,
            (0, framework_1.validateAndTransformQuery)(validators_1.AdminGetColumnsParams, {}),
        ],
    },
];
//# sourceMappingURL=middlewares.js.map