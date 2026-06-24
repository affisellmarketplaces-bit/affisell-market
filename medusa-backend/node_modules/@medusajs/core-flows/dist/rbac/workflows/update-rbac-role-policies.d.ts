import { UpdateRbacRolePolicyDTO } from "@medusajs/types";
/**
 * @ignore
 * @featureFlag rbac
 */
export type UpdateRbacRolePoliciesWorkflowInput = {
    selector: Record<string, any>;
    update: Omit<UpdateRbacRolePolicyDTO, "id">;
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacRolePoliciesWorkflowId = "update-rbac-role-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacRolePoliciesWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<UpdateRbacRolePoliciesWorkflowInput, import("@medusajs/types").RbacRolePolicyDTO[], []>;
//# sourceMappingURL=update-rbac-role-policies.d.ts.map