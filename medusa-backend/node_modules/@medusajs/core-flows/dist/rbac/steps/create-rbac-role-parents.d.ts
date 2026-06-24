/**
 * @ignore
 * @featureFlag rbac
 */
export type CreateRbacRoleParentDTO = {
    role_id: string;
    parent_id: string;
    metadata?: Record<string, unknown> | null;
};
/**
 * @ignore
 * @featureFlag rbac
 */
export type CreateRbacRoleParentsStepInput = {
    role_parents: CreateRbacRoleParentDTO[];
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacRoleParentsStepId = "create-rbac-role-parents";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacRoleParentsStep: import("@medusajs/framework/workflows-sdk").StepFunction<CreateRbacRoleParentsStepInput, import("@medusajs/types").RbacRoleParentDTO[]>;
//# sourceMappingURL=create-rbac-role-parents.d.ts.map