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
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: roles } = await query.graph({
        entity: "rbac_role",
        filters: { id: req.params.id },
        fields: req.queryConfig.fields,
    });
    const role = roles[0];
    if (!role) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Role with id: ${req.params.id} not found`);
    }
    res.status(200).json({ role });
};
exports.GET = GET;
/**
 * @ignore
 * @featureFlag rbac
 */
const POST = async (req, res) => {
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const { data: existing } = await query.graph({
        entity: "rbac_role",
        filters: { id: req.params.id },
        fields: ["id"],
    });
    const existingRole = existing[0];
    if (!existingRole) {
        throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_FOUND, `Role with id "${req.params.id}" not found`);
    }
    const { result } = await (0, core_flows_1.updateRbacRolesWorkflow)(req.scope).run({
        input: {
            actor_id: req.auth_context.actor_id,
            actor: req.auth_context.actor_type,
            selector: { id: req.params.id },
            update: req.validatedBody,
        },
    });
    const { data: roles } = await query.graph({
        entity: "rbac_role",
        filters: { id: result[0].id },
        fields: req.queryConfig.fields,
    });
    const role = roles[0];
    res.status(200).json({ role });
};
exports.POST = POST;
/**
 * @ignore
 * @featureFlag rbac
 */
const DELETE = async (req, res) => {
    const id = req.params.id;
    await (0, core_flows_1.deleteRbacRolesWorkflow)(req.scope).run({
        input: { ids: [id] },
    });
    res.status(200).json({
        id,
        object: "rbac_role",
        deleted: true,
    });
};
exports.DELETE = DELETE;
//# sourceMappingURL=route.js.map