"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProduction = isProduction;
/**
 * Returns whether the current process is running in a production
 * environment based on `NODE_ENV`. Both `"production"` and the short
 * form `"prod"` are considered production.
 */
function isProduction() {
    return ["production", "prod"].includes(process.env.NODE_ENV || "");
}
//# sourceMappingURL=is-production.js.map