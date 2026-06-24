import { UpdateRbacPolicyDTO } from "@medusajs/types";
/**
 * @ignore
 * @featureFlag rbac
 */
export type UpdateRbacPoliciesWorkflowInput = {
    selector: Record<string, any>;
    update: Omit<UpdateRbacPolicyDTO, "id">;
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacPoliciesWorkflowId = "update-rbac-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacPoliciesWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<UpdateRbacPoliciesWorkflowInput, import("@medusajs/types").RbacPolicyDTO[], []>;
//# sourceMappingURL=update-rbac-policies.d.ts.map