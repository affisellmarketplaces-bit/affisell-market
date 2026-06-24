"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = void 0;
const core_flows_1 = require("@medusajs/core-flows");
/**
 * @ignore
 * @featureFlag rbac
 */
const DELETE = async (req, res) => {
    const { id: userId, role_id: roleId } = req.params;
    await (0, core_flows_1.removeUserRolesWorkflow)(req.scope).run({
        input: {
            actor_id: req.auth_context.actor_id,
            actor: req.auth_context.actor_type,
            user_id: userId,
            role_ids: [roleId],
        },
    });
    res.status(200).json({
        id: roleId,
        object: "user_role",
        deleted: true,
    });
};
exports.DELETE = DELETE;
//# sourceMappingURL=route.js.map