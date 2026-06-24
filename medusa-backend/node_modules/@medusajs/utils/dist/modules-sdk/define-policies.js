"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyResource = exports.PolicyOperation = exports.Policy = exports.WILDCARD = exports.MedusaPolicySymbol = void 0;
exports.definePolicies = definePolicies;
const common_1 = require("../common");
const to_snake_case_1 = require("../common/to-snake-case");
exports.MedusaPolicySymbol = Symbol.for("MedusaPolicy");
/**
 * The single character used as the RBAC wildcard across both resource and
 * operation slots. All RBAC code that needs to read, write, or compare the
 * wildcard should import this constant.
 */
exports.WILDCARD = "*";
/**
 * Global registry for all unique resources.
 */
const PolicyResource = global.PolicyResource ?? {};
exports.PolicyResource = PolicyResource;
global.PolicyResource ??= PolicyResource;
/**
 * Global registry for all unique operations.
 */
const defaultOperations = ["read", "create", "update", "delete", exports.WILDCARD];
const PolicyOperation = global.PolicyOperation ?? { ALL: exports.WILDCARD };
exports.PolicyOperation = PolicyOperation;
const normalizeKey = (element) => {
    return element === exports.WILDCARD ? exports.WILDCARD : (0, to_snake_case_1.toSnakeCase)(element);
};
for (const operation of defaultOperations) {
    const operationKey = normalizeKey(operation);
    PolicyOperation[operationKey] = operation;
}
global.PolicyOperation ??= PolicyOperation;
const Policy = global.Policy ?? {};
exports.Policy = Policy;
global.Policy ??= Policy;
/**
 * Define RBAC policies that will be automatically synced to the database
 * when the application starts.
 *
 * @param policies - Single policy or array of policy definitions
 *
 * @example
 * ```ts
 * definePolicies({
 *   name: "ReadBrands",
 *   resource: "brand",
 *   operation: "read"
 *   description: "Read brands"
 * })
 *
 * definePolicies([
 *   {
 *     name: "ReadBrands",
 *     resource: "brand",
 *     operation: "read"
 *   },
 *   {
 *     name: "CreateBrands",
 *     resource: "brand",
 *     operation: "create"
 *   }
 * ])
 * ```
 */
function definePolicies(policies) {
    const callerFilePath = (0, common_1.getCallerFilePath)();
    if ((0, common_1.isFileDisabled)(callerFilePath ?? "")) {
        return { [common_1.MEDUSA_SKIP_FILE]: true };
    }
    const policiesArray = Array.isArray(policies) ? policies : [policies];
    for (const policy of policiesArray) {
        if (!policy.name || !policy.resource || !policy.operation) {
            throw new Error(`Policy definition must include name, resource, and operation. Received: ${JSON.stringify(policy, null, 2)}`);
        }
    }
    for (const policy of policiesArray) {
        const resourceKey = normalizeKey(policy.resource);
        const operationKey = normalizeKey(policy.operation);
        policy.resource = resourceKey;
        policy.operation = operationKey;
        PolicyResource[resourceKey] = policy.resource;
        PolicyOperation[operationKey] = policy.operation;
        // Register in Policy object with name as key
        Policy[policy.name] = { ...policy };
    }
    const output = {
        [exports.MedusaPolicySymbol]: true,
        policies: policiesArray,
    };
    return output;
}
//# sourceMappingURL=define-policies.js.map