"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapWithPoliciesCheck = wrapWithPoliciesCheck;
const utils_1 = require("@medusajs/utils");
const has_permission_1 = require("../../policies/has-permission");
/**
 * Core permission checking logic for middleware and routes
 */
async function checkPermissions(policies, req) {
    // Normalize policies to array
    const policyList = Array.isArray(policies) ? policies : [policies];
    if (!policyList.length) {
        return;
    }
    const authContext = req.auth_context;
    // Get roles from JWT token's app_metadata
    const roleIds = authContext?.app_metadata?.roles || [];
    if (!roleIds.length) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.FORBIDDEN, "Forbidden");
    }
    const hasAccess = await (0, has_permission_1.hasPermission)({
        roles: roleIds,
        actions: policyList,
        container: req.scope,
    });
    if (!hasAccess) {
        const policyKeys = policyList
            .map((p) => `${p.resource}:${p.operation}`)
            .join(", ");
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.FORBIDDEN, `Insufficient permissions. Required policies: ${policyKeys}`);
    }
}
/**
 * Wraps a middleware or route handler with RBAC permission checking.
 * Checks if the authenticated user has the required policies before executing the handler.
 *
 * @param handler - The original middleware or route handler to wrap
 * @param policies - Single policy or array of policies to check
 * @returns Wrapped middleware or route function that checks permissions first
 */
function wrapWithPoliciesCheck(handler, policies) {
    return async (req, res, next) => {
        try {
            req.policies ??= [];
            req.policies.push(...(Array.isArray(policies) ? policies : [policies]));
            await checkPermissions(policies, req);
            return handler(req, res, next);
        }
        catch (error) {
            return next(error);
        }
    };
}
//# sourceMappingURL=check-permissions.js.map