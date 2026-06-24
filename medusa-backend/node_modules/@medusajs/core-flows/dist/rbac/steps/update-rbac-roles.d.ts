import { UpdateRbacRoleDTO } from "@medusajs/types";
/**
 * @ignore
 * @featureFlag rbac
 */
export type UpdateRbacRolesStepInput = {
    selector: Record<string, any>;
    update: Omit<UpdateRbacRoleDTO, "id">;
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacRolesStepId = "update-rbac-roles";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacRolesStep: import("@medusajs/framework/workflows-sdk").StepFunction<UpdateRbacRolesStepInput, import("@medusajs/types").RbacRoleDTO[]>;
//# sourceMappingURL=update-rbac-roles.d.ts.map