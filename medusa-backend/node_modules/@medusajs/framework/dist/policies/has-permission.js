"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPermission = hasPermission;
exports.resolvePermissions = resolvePermissions;
const utils_1 = require("@medusajs/utils");
/**
 * Applies wildcard-aware matching to decide whether any of the
 * supplied roles grants `(resource, operation)`. This is the single source of
 * truth for wildcard semantics used by both {@link hasPermission} and
 * {@link resolvePermissions}.
 */
function policyAllows(rolePoliciesMap, resource, operation) {
    for (const resourceMap of rolePoliciesMap.values()) {
        const allowedOps = new Set([
            ...(resourceMap.get(resource) || []),
            ...(resourceMap.get(utils_1.WILDCARD) || []),
        ]);
        if (allowedOps.has(operation) || allowedOps.has(utils_1.WILDCARD)) {
            return true;
        }
    }
    return false;
}
/**
 * Checks if the given role(s) have permission to perform the specified action(s).
 *
 * @param input - The input containing roles, actions, and container
 * @returns true if all actions are permitted, false otherwise
 *
 * @example
 * ```ts
 * const canWrite = await hasPermission({
 *   roles: ['role_123'],
 *   actions: { resource: 'product', operation: 'write' },
 *   container
 * })
 *
 * const canDeleteAndWrite = await hasPermission({
 *   roles: ['role_123'],
 *   actions: { resource: 'product', operation: ['delete', 'write'] },
 *   container
 * })
 * ```
 */
async function hasPermission(input) {
    const { roles, actions, container } = input;
    const roleIds = Array.isArray(roles) ? roles : [roles];
    const actionList = Array.isArray(actions) ? actions : [actions];
    const ffRouter = container.resolve(utils_1.ContainerRegistrationKeys.FEATURE_FLAG_ROUTER);
    const isDisabled = !ffRouter.isFeatureEnabled("rbac");
    if (isDisabled || !roleIds?.length || !actionList?.length) {
        return true;
    }
    const rolePoliciesMap = await fetchRolePolicies(roleIds, container);
    for (const action of actionList) {
        const operations = Array.isArray(action.operation)
            ? action.operation
            : [action.operation];
        for (const op of operations) {
            if (!policyAllows(rolePoliciesMap, action.resource, op)) {
                return false;
            }
        }
    }
    return true;
}
/**
 * Resolves the actor's effective permission set: the subset of `universe` that
 * the actor is granted, with wildcards expanded against concrete entries.
 *
 * This is the "inverse" of {@link hasPermission}. It is intended for use by
 * endpoints that need to hand the client a flat permission list (so the client
 * can do literal lookups instead of duplicating wildcard semantics).
 *
 * @example
 * ```ts
 * const granted = await resolvePermissions({
 *   roles: ["role_super_admin"],
 *   universe: [
 *     { resource: "product", operation: "read" },
 *     { resource: "customer", operation: "create" },
 *   ],
 *   container,
 * })
 * // granted = Set { "product:read", "customer:create" }
 * ```
 */
async function resolvePermissions(input) {
    const { roles, universe, container } = input;
    const roleIds = Array.isArray(roles) ? roles : [roles];
    const ffRouter = container.resolve(utils_1.ContainerRegistrationKeys.FEATURE_FLAG_ROUTER);
    if (!ffRouter.isFeatureEnabled("rbac")) {
        return new Set(universe.map(({ resource, operation }) => `${resource}:${operation}`));
    }
    if (!roleIds.length) {
        return new Set();
    }
    const rolePoliciesMap = await fetchRolePolicies(roleIds, container);
    const granted = new Set();
    for (const { resource, operation } of universe) {
        if (policyAllows(rolePoliciesMap, resource, operation)) {
            granted.add(`${resource}:${operation}`);
        }
    }
    return granted;
}
/**
 * Fetches a single role's policies from cache or database.
 */
async function fetchSingleRolePolicies(roleId, container) {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const tags = [];
    return await (0, utils_1.useCache)(async () => {
        const { data: roles } = await query.graph({
            entity: "rbac_role",
            fields: ["id", "policies.*"],
            filters: { id: roleId },
        });
        const role = roles[0];
        const resourceMap = new Map();
        tags.push(`rbac_role:${roleId}`);
        if (role?.policies && Array.isArray(role.policies)) {
            const policyIds = [];
            for (const policy of role.policies) {
                policyIds.push(policy.id);
                if (!resourceMap.has(policy.resource)) {
                    resourceMap.set(policy.resource, new Set());
                }
                resourceMap.get(policy.resource).add(policy.operation);
                tags.push(`rbac_policy:${policy.id}`);
            }
        }
        return resourceMap;
    }, {
        container,
        key: roleId,
        tags,
        ttl: 60 * 60 * 24 * 7,
        providers: ["cache-memory"],
    });
}
/**
 * Fetches policies for multiple roles by composing individually cached role queries.
 */
async function fetchRolePolicies(roleIds, container) {
    const rolePoliciesMap = new Map();
    await Promise.all(roleIds.map(async (roleId) => {
        const resourceMap = await fetchSingleRolePolicies(roleId, container);
        rolePoliciesMap.set(roleId, resourceMap);
    }));
    return rolePoliciesMap;
}
//# sourceMappingURL=has-permission.js.map