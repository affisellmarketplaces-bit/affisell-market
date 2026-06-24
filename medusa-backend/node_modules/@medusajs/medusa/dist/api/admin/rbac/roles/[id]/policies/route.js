"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
const rbac_1 = __importDefault(require("../../../../../../feature-flags/rbac"));
/**
 * @ignore
 * @featureFlag rbac
 */
const GET = async (req, res) => {
    const roleId = req.params.id;
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: policies, metadata } = await query.graph({
        entity: "rbac_role_policy",
        fields: req.queryConfig?.fields,
        filters: { ...req.filterableFields, role_id: roleId },
        pagination: req.queryConfig?.pagination || {},
    });
    res.status(200).json({
        policies,
        count: metadata?.count ?? 0,
        offset: metadata?.skip ?? 0,
        limit: metadata?.take ?? 0,
    });
};
exports.GET = GET;
/**
 * @ignore
 * @featureFlag rbac
 */
const POST = async (req, res) => {
    const roleId = req.params.id;
    const { policies } = req.validatedBody;
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const rolePolicies = policies.map((policyId) => ({
        role_id: roleId,
        policy_id: policyId,
    }));
    const { result } = await (0, core_flows_1.createRbacRolePoliciesWorkflow)(req.scope).run({
        input: {
            actor_id: req.auth_context.actor_id,
            actor: req.auth_context.actor_type,
            policies: rolePolicies,
        },
    });
    const { data } = await query.graph({
        entity: "rbac_role_policy",
        fields: req.queryConfig?.fields,
        filters: { id: result.map((r) => r.id) },
    });
    res.status(200).json({ policies: data });
};
exports.POST = POST;
(0, utils_1.defineFileConfig)({
    isDisabled: () => !utils_1.FeatureFlag.isFeatureEnabled(rbac_1.default.key),
});
//# sourceMappingURL=route.js.map