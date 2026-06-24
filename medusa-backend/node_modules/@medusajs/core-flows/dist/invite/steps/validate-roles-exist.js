"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRolesExistStep = exports.validateRolesExistStepId = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.validateRolesExistStepId = "validate-roles-exist-step";
/**
 * This step validates that the provided role IDs exist in the RBAC module.
 * Throws an error if any role is not found.
 *
 * @example
 * validateRolesExistStep(["role_123", "role_456"])
 * @ignore
 * @featureFlag rbac
 */
exports.validateRolesExistStep = (0, workflows_sdk_1.createStep)(exports.validateRolesExistStepId, async (roleIds, { container }) => {
    if (!roleIds.length) {
        return new workflows_sdk_1.StepResponse(undefined);
    }
    const rbacService = container.resolve(utils_1.Modules.RBAC);
    const existingRoles = await rbacService.listRbacRoles({
        id: roleIds,
    });
    const existingRoleIds = new Set(existingRoles.map((r) => r.id));
    const missingRoles = roleIds.filter((id) => !existingRoleIds.has(id));
    if (missingRoles.length) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `The following role IDs do not exist: ${missingRoles.join(", ")}`);
    }
    return new workflows_sdk_1.StepResponse(undefined);
});
//# sourceMappingURL=validate-roles-exist.js.map