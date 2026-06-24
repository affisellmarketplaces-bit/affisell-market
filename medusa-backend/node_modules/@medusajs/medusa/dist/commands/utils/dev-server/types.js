"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
/**
 * Configuration for path matching and exclusions
 */
exports.CONFIG = {
    EXCLUDED_PATH_PATTERNS: ["node_modules"],
    RESOURCE_PATH_PATTERNS: {
        route: "api/",
        workflow: "workflows/",
        subscriber: "subscribers/",
        job: "jobs/",
        module: "modules/",
    },
};
//# sourceMappingURL=types.js.map