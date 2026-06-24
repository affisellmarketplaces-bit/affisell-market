import { UpdateRbacRolePolicyDTO } from "@medusajs/types";
/**
 * @ignore
 * @featureFlag rbac
 */
export type UpdateRbacRolePoliciesStepInput = {
    selector: Record<string, any>;
    update: Omit<UpdateRbacRolePolicyDTO, "id">;
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacRolePoliciesStepId = "update-rbac-role-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacRolePoliciesStep: import("@medusajs/framework/workflows-sdk").StepFunction<UpdateRbacRolePoliciesStepInput, import("@medusajs/types").RbacRolePolicyDTO[]>;
//# sourceMappingURL=update-rbac-role-policies.d.ts.map