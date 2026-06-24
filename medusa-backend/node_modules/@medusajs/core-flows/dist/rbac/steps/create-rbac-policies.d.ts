import { CreateRbacPolicyDTO } from "@medusajs/types";
/**
 * @ignore
 * @featureFlag rbac
 */
export type CreateRbacPoliciesStepInput = {
    policies: CreateRbacPolicyDTO[];
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacPoliciesStepId = "create-rbac-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacPoliciesStep: import("@medusajs/framework/workflows-sdk").StepFunction<CreateRbacPoliciesStepInput, import("@medusajs/types").RbacPolicyDTO[]>;
//# sourceMappingURL=create-rbac-policies.d.ts.map