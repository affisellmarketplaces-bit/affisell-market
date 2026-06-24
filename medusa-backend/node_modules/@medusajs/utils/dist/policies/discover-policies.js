"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverPoliciesFromDir = discoverPoliciesFromDir;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const common_1 = require("../common");
const modules_sdk_1 = require("../modules-sdk");
const excludedFiles = ["index.js", "index.ts"];
const excludedExtensions = [".d.ts", ".d.ts.map", ".js.map"];
function isPolicyExport(value) {
    return !!value && typeof value === "object" && modules_sdk_1.MedusaPolicySymbol in value;
}
/**
 * Discover policy definitions from a directory and subdirectories
 */
async function discoverPoliciesFromDir(sourcePath, maxDepth = 2) {
    if (!sourcePath) {
        return;
    }
    const root = (0, path_1.normalize)(sourcePath);
    const allEntries = await (0, common_1.readDirRecursive)(root, {
        ignoreMissing: true,
        maxDepth,
    });
    const policyDirs = allEntries
        .filter((e) => e.isDirectory() && e.name === "policies")
        .map((e) => (0, path_1.join)(e.path, e.name));
    if (!policyDirs.length) {
        return;
    }
    await Promise.all(policyDirs.map(async (scanDir) => {
        const entries = await (0, promises_1.readdir)(scanDir, { withFileTypes: true });
        await Promise.all(entries.map(async (entry) => {
            if (entry.isDirectory()) {
                return;
            }
            if (excludedExtensions.some((ext) => entry.name.endsWith(ext)) ||
                excludedFiles.includes(entry.name)) {
                return;
            }
            // Import the file - this will execute definePolicies() calls
            const fileExports = await (0, common_1.dynamicImport)((0, path_1.join)(scanDir, entry.name));
            // Validate that at least one export is a policy
            const values = Object.values(fileExports);
            const hasPolicies = values.some((value) => isPolicyExport(value));
            if (!hasPolicies) {
                console.warn(`File ${entry.name} in policies directory does not export any policies`);
            }
        }));
    }));
}
//# sourceMappingURL=discover-policies.js.map