"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.policiesLoader = policiesLoader;
const utils_1 = require("@medusajs/utils");
const path_1 = require("path");
/**
 * Load RBAC policies from a directory
 * @param sourcePath - Path to scan for policies directories
 */
async function policiesLoader(sourcePath) {
    if (!sourcePath) {
        return;
    }
    const policyDir = (0, path_1.normalize)(sourcePath);
    await (0, utils_1.discoverPoliciesFromDir)(policyDir);
}
//# sourceMappingURL=policy-loader.js.map