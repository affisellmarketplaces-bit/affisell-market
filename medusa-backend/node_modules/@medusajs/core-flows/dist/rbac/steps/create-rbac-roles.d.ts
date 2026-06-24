/**
 * @ignore
 * @featureFlag rbac
 */
export type CreateRbacRoleDTO = {
    name: string;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
};
/**
 * @ignore
 * @featureFlag rbac
 */
export type CreateRbacRolesStepInput = {
    roles: CreateRbacRoleDTO[];
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacRolesStepId = "create-rbac-roles";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const createRbacRolesStep: import("@medusajs/framework/workflows-sdk").StepFunction<CreateRbacRolesStepInput, import("@medusajs/types").RbacRoleDTO[]>;
//# sourceMappingURL=create-rbac-roles.d.ts.map