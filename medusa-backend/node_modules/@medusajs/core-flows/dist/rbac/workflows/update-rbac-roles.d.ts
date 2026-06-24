import { UpdateRbacRoleDTO } from "@medusajs/types";
/**
 * @ignore
 * @featureFlag rbac
 */
export type UpdateRbacRolesWorkflowInput = {
    actor_id?: string;
    actor?: string;
    selector: Record<string, any>;
    update: Omit<UpdateRbacRoleDTO, "id"> & {
        parent_ids?: string[];
        policy_ids?: string[];
    };
};
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacRolesWorkflowId = "update-rbac-roles";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const updateRbacRolesWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<UpdateRbacRolesWorkflowInput, import("@medusajs/types").RbacRoleDTO[], []>;
//# sourceMappingURL=update-rbac-roles.d.ts.map