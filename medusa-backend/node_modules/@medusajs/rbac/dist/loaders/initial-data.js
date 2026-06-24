"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
exports.default = async ({ container, options, }) => {
    const rbacRoleService = container.resolve("rbacRoleService");
    const rbacPolicyService = container.resolve("rbacPolicyService");
    const rbacRolePolicyService = container.resolve("rbacRolePolicyService");
    // Create super admin role
    const role = await rbacRoleService.upsert({
        id: "role_super_admin",
        name: "Super Admin",
        description: "Super admin role with full access to all resources and operations",
    });
    const policy = await rbacPolicyService.upsert({
        id: "rpol_super_admin",
        key: `${utils_1.WILDCARD}:${utils_1.WILDCARD}`,
        resource: utils_1.WILDCARD,
        operation: utils_1.WILDCARD,
        name: "Super Admin",
        description: "Super admin policy with full access to all resources and operations",
    });
    await rbacRolePolicyService.upsert({
        id: "rlpl_super_admin",
        role_id: role.id,
        policy_id: policy.id,
    });
};
//# sourceMappingURL=initial-data.js.map