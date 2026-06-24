"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
const rbac_1 = __importDefault(require("../../../../../../../feature-flags/rbac"));
/**
 * @ignore
 * @featureFlag rbac
 */
const DELETE = async (req, res) => {
    const { policy_id, id: role_id } = req.params;
    // First, we need to find the role_policy_id that connects this role and policy
    const query = req.scope.resolve("query");
    const { data: rolePolicies } = await query.graph({
        entity: "rbac_role_policy",
        fields: ["id"],
        filters: { role_id, policy_id },
    });
    const rolePolicyId = rolePolicies[0]?.id;
    await (0, core_flows_1.deleteRbacRolePoliciesWorkflow)(req.scope).run({
        input: {
            role_policy_ids: rolePolicyId ? [rolePolicyId] : [],
        },
    });
    res.status(200).json({
        id: rolePolicyId,
        object: "rbac_role_policy",
        deleted: true,
    });
};
exports.DELETE = DELETE;
(0, utils_1.defineFileConfig)({
    isDisabled: () => !utils_1.FeatureFlag.isFeatureEnabled(rbac_1.default.key),
});
//# sourceMappingURL=route.js.map