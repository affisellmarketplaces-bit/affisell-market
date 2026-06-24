"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
const rbac_1 = __importDefault(require("../../../../feature-flags/rbac"));
/**
 * @ignore
 * @featureFlag rbac
 */
const GET = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: policies, metadata } = await query.graph({
        entity: "rbac_policy",
        fields: req.queryConfig.fields,
        filters: req.filterableFields,
        pagination: req.queryConfig.pagination,
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
    const input = [req.validatedBody];
    const { result } = await (0, core_flows_1.createRbacPoliciesWorkflow)(req.scope).run({
        input: { policies: input },
    });
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: policies } = await query.graph({
        entity: "rbac_policy",
        fields: req.queryConfig.fields,
        filters: { id: result[0].id },
    });
    const policy = policies[0];
    res.status(200).json({ policy });
};
exports.POST = POST;
(0, utils_1.defineFileConfig)({
    isDisabled: () => !utils_1.FeatureFlag.isFeatureEnabled(rbac_1.default.key),
});
//# sourceMappingURL=route.js.map