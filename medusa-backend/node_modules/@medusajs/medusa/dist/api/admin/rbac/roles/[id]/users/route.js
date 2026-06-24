"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.POST = exports.GET = void 0;
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
    const { data: links, metadata } = await query.graph({
        entity: "user_rbac_role",
        fields: req.queryConfig?.fields,
        filters: { ...req.filterableFields, rbac_role_id: roleId },
        pagination: req.queryConfig?.pagination || {},
    });
    const users = links.map((link) => link.user);
    res.status(200).json({
        users,
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
    const { users } = req.validatedBody;
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: [role], } = await query.graph({
        entity: "rbac_role",
        fields: ["id"],
        filters: { id: roleId },
    });
    if (!role) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Role with id "${roleId}" not found`);
    }
    await (0, core_flows_1.assignUserRolesWorkflow)(req.scope).run({
        input: {
            actor_id: req.auth_context.actor_id,
            actor: req.auth_context.actor_type,
            role_id: roleId,
            user_ids: users,
        },
    });
    const { data: links } = await query.graph({
        entity: "user_rbac_role",
        fields: ["user.*"],
        filters: { rbac_role_id: roleId },
    });
    const roleUsers = links.map((link) => link.user);
    res.status(200).json({ users: roleUsers });
};
exports.POST = POST;
/**
 * @ignore
 * @featureFlag rbac
 */
const DELETE = async (req, res) => {
    const roleId = req.params.id;
    const { users } = req.validatedBody;
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: [role], } = await query.graph({
        entity: "rbac_role",
        fields: ["id"],
        filters: { id: roleId },
    });
    if (!role) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Role with id "${roleId}" not found`);
    }
    await (0, core_flows_1.removeUserRolesWorkflow)(req.scope).run({
        input: {
            actor_id: req.auth_context.actor_id,
            actor: req.auth_context.actor_type,
            role_id: roleId,
            user_ids: users,
        },
    });
    res.status(200).json({
        ids: users,
        object: "role_user",
        deleted: true,
    });
};
exports.DELETE = DELETE;
(0, utils_1.defineFileConfig)({
    isDisabled: () => !utils_1.FeatureFlag.isFeatureEnabled(rbac_1.default.key),
});
//# sourceMappingURL=route.js.map