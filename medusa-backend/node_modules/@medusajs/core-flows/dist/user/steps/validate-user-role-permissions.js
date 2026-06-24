"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUserRolePermissionsStep = exports.validateUserRolePermissionsStepId = void 0;
const framework_1 = require("@medusajs/framework");
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.validateUserRolePermissionsStepId = "validate-user-role-permissions";
/**
 * Validates that the actor has all the policies from the roles being assigned.
 * A user can only assign roles whose policies they themselves have.
 * @ignore
 * @featureFlag rbac
 */
exports.validateUserRolePermissionsStep = (0, workflows_sdk_1.createStep)(exports.validateUserRolePermissionsStepId, async (data, { container }) => {
    const { actor_id, actor, role_ids } = data;
    if (!role_ids?.length) {
        return new workflows_sdk_1.StepResponse(void 0);
    }
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: targetRoles } = await query.graph({
        entity: "rbac_role",
        fields: ["id", "policies.resource", "policies.operation"],
        filters: { id: role_ids },
    });
    const actionsToCheck = [];
    for (const role of targetRoles) {
        for (const policy of role.policies ?? []) {
            actionsToCheck.push({
                resource: policy.resource,
                operation: policy.operation,
            });
        }
    }
    if (!actionsToCheck.length) {
        return new workflows_sdk_1.StepResponse(void 0);
    }
    const { data: actors } = await query.graph({
        entity: actor ?? "user",
        fields: ["rbac_roles.id"],
        filters: { id: actor_id },
    });
    const actorRoleIds = actors?.[0]?.rbac_roles?.map((r) => r.id).filter(Boolean) ?? [];
    if (!actorRoleIds.length) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.FORBIDDEN, "You do not have permission to assign these roles");
    }
    const allowed = await (0, framework_1.hasPermission)({
        roles: actorRoleIds,
        actions: actionsToCheck,
        container,
    });
    if (!allowed) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.FORBIDDEN, "You do not have permission to assign these roles");
    }
    return new workflows_sdk_1.StepResponse(void 0);
});
//# sourceMappingURL=validate-user-role-permissions.js.map