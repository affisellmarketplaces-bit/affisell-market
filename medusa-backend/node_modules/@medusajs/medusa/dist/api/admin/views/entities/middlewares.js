"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entitiesRoutesMiddlewares = void 0;
const middleware_1 = require("../[entity]/configurations/middleware");
exports.entitiesRoutesMiddlewares = [
    // Apply feature flag check
    {
        method: ["GET"],
        matcher: "/admin/views/entities",
        middlewares: [middleware_1.ensureViewConfigurationsEnabled],
    },
];
//# sourceMappingURL=middlewares.js.map