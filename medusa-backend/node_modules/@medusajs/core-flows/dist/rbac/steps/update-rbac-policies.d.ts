import { UpdateRbacPolicyDTO } from "@medusajs/types";
/**
 * @ignore
 * @featureFlag rbac
 */
export type UpdateRbacPoliciesStepInput = {
    selector: Record<string, any>;
    update: Omit<UpdateRbacPolicyDTO, "id">;
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacPoliciesStepId = "update-rbac-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacPoliciesStep: import("@medusajs/framework/workflows-sdk").StepFunction<UpdateRbacPoliciesStepInput, import("@medusajs/types").RbacPolicyDTO[]>;
//# sourceMappingURL=update-rbac-policies.d.ts.map