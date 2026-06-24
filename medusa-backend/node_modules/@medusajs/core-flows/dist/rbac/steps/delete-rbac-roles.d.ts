/**
 * @ignore
 * @featureFlag rbac
 */
export type DeleteRbacRolesStepInput = string[];
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const deleteRbacRolesStepId = "delete-rbac-roles";
/**
 * This step deletes one or more RBAC roles.
 * @param ids - The IDs of the roles to delete
 * @param container - The workflow container
 * @returns A step response with the deleted role IDs
 * @ignore
 * @featureFlag rbac
 */
export declare const deleteRbacRolesStep: import("@medusajs/framework/workflows-sdk").StepFunction<DeleteRbacRolesStepInput, any>;
//# sourceMappingURL=delete-rbac-roles.d.ts.map