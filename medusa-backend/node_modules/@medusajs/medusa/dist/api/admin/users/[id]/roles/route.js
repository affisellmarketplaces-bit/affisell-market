"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.POST = exports.GET = void 0;
const core_flows_1 = require("@medusajs/core-flows");
const utils_1 = require("@medusajs/framework/utils");
/**
 * @ignore
 * @featureFlag rbac
 */
const GET = async (req, res) => {
    const userId = req.params.id;
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: links, metadata } = await query.graph({
        entity: "user_rbac_role",
        fields: req.queryConfig?.fields,
        filters: { ...req.filterableFields, user_id: userId },
        pagination: req.queryConfig?.pagination || {},
    });
    const roles = links.map((link) => link.rbac_role);
    res.status(200).json({
        roles,
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
    const userId = req.params.id;
    const { roles } = req.validatedBody;
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: [user], } = await query.graph({
        entity: "user",
        fields: ["id"],
        filters: { id: userId },
    });
    if (!user) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `User with id "${userId}" not found`);
    }
    await (0, core_flows_1.assignUserRolesWorkflow)(req.scope).run({
        input: {
            actor_id: req.auth_context.actor_id,
            actor: req.auth_context.actor_type,
            user_id: userId,
            role_ids: roles,
        },
    });
    const { data: links } = await query.graph({
        entity: "user_rbac_role",
        fields: ["rbac_role.*"],
        filters: { user_id: userId },
    });
    const userRoles = links.map((link) => link.rbac_role);
    res.status(200).json({ roles: userRoles });
};
exports.POST = POST;
/**
 * @ignore
 * @featureFlag rbac
 */
const DELETE = async (req, res) => {
    const userId = req.params.id;
    const { roles } = req.validatedBody;
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: [user], } = await query.graph({
        entity: "user",
        fields: ["id"],
        filters: { id: userId },
    });
    if (!user) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `User with id "${userId}" not found`);
    }
    await (0, core_flows_1.removeUserRolesWorkflow)(req.scope).run({
        input: {
            actor_id: req.auth_context.actor_id,
            actor: req.auth_context.actor_type,
            user_id: userId,
            role_ids: roles,
        },
    });
    res.status(200).json({
        ids: roles,
        object: "user_role",
        deleted: true,
    });
};
exports.DELETE = DELETE;
//# sourceMappingURL=route.js.map