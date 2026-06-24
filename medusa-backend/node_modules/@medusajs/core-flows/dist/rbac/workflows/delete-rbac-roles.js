"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRbacRolesWorkflow = exports.deleteRbacRolesWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacRolesWorkflowId = "delete-rbac-roles";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacRolesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.deleteRbacRolesWorkflowId, (input) => {
    (0, steps_1.deleteRbacRolesStep)(input.ids);
});
//# sourceMappingURL=delete-rbac-roles.js.map