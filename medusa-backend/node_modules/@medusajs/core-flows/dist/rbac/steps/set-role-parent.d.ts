/**
 * @ignore
 * @featureFlag rbac
 */
export type SetRoleParentStepInput = Array<{
    role_id: string;
    parent_ids: string[];
}>;
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const setRoleParentStepId = "set-role-parent";
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const setRoleParentStep: import("@medusajs/framework/workflows-sdk").StepFunction<SetRoleParentStepInput, {
    created: any[];
    removedCount: number;
}>;
//# sourceMappingURL=set-role-parent.d.ts.map