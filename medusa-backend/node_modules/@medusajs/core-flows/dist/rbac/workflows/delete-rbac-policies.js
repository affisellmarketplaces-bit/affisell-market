"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRbacPoliciesWorkflow = exports.deleteRbacPoliciesWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const steps_1 = require("../steps");
/**
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacPoliciesWorkflowId = "delete-rbac-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
exports.deleteRbacPoliciesWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.deleteRbacPoliciesWorkflowId, (input) => {
    (0, steps_1.deleteRbacPoliciesStep)(input.ids);
});
//# sourceMappingURL=delete-rbac-policies.js.map