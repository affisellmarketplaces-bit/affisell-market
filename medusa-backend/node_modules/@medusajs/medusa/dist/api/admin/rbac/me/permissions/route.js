"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const rbac_1 = __importDefault(require("../../../../../feature-flags/rbac"));
/**
 * Returns the authenticated actor's effective permission set as a flat array
 * of `resource:operation` strings, with wildcards already expanded.
 *
 * The "universe" of meaningful permissions is the union of:
 *   - policies registered in code via `definePolicies()` (the global `Policy`
 *     registry), and
 *   - distinct `(resource, operation)` rows currently in `rbac_policy` (covers
 *     policies registered at runtime by admins or plugins).
 *
 * Wildcard-only tuples are excluded — they're grants, not permissions.
 *
 * Clients can rely on literal set membership.
 *
 * @ignore
 * @featureFlag rbac
 */
const GET = async (req, res) => {
    const actorId = req.auth_context.actor_id;
    const actorType = req.auth_context.actor_type;
    if (!actorId || !actorType) {
        res.status(200).json({ permissions: [] });
        return;
    }
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: actors } = await query.graph({
        entity: actorType,
        fields: ["id", "rbac_roles.id"],
        filters: { id: actorId },
    });
    const roleIds = actors?.[0]?.rbac_roles?.map((r) => r.id).filter(Boolean) ??
        [];
    // Build the universe from code-registered + DB-persisted policies.
    const universe = [];
    const seen = new Set();
    const consider = (resource, operation) => {
        if (!resource ||
            !operation ||
            resource === utils_1.WILDCARD ||
            operation === utils_1.WILDCARD) {
            return;
        }
        const key = `${resource}:${operation}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        universe.push({ resource, operation });
    };
    for (const definition of Object.values(utils_1.Policy)) {
        consider(definition?.resource, definition?.operation);
    }
    const { data: persistedPolicies } = await query.graph({
        entity: "rbac_policy",
        fields: ["resource", "operation"],
    });
    for (const policy of persistedPolicies ?? []) {
        consider(policy?.resource, policy?.operation);
    }
    const granted = await (0, framework_1.resolvePermissions)({
        roles: roleIds,
        universe,
        container: req.scope,
    });
    res.status(200).json({ permissions: Array.from(granted).sort() });
};
exports.GET = GET;
(0, utils_1.defineFileConfig)({
    isDisabled: () => !utils_1.FeatureFlag.isFeatureEnabled(rbac_1.default.key),
});
//# sourceMappingURL=route.js.map