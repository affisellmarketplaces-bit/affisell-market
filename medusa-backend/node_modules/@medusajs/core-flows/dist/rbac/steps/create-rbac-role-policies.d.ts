import { CreateRbacRolePolicyDTO } from "@medusajs/types";
/**
 * @ignore
 * @featureFlag rbac
 */
export type CreateRbacRolePoliciesStepInput = {
    policies: CreateRbacRolePolicyDTO[];
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacRolePoliciesStepId = "create-rbac-role-policies";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacRolePoliciesStep: import("@medusajs/framework/workflows-sdk").StepFunction<CreateRbacRolePoliciesStepInput, import("@medusajs/types").RbacRolePolicyDTO[]>;
//# sourceMappingURL=create-rbac-role-policies.d.ts.map