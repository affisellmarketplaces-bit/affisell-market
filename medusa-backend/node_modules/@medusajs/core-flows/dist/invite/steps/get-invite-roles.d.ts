/**
 * @ignore
 * @featureFlag rbac
 */
export interface GetInviteRolesStepInput {
    invite_id: string;
}
/**
 * @ignore
 * @featureFlag rbac
 */
export declare const getInviteRolesStepId = "get-invite-roles-step";
/**
 * This step retrieves the roles associated with an invite.
 *
 * @example
 * const data = getInviteRolesStep({
 *   invite_id: "invite_123"
 * })
 * @ignore
 * @featureFlag rbac
 */
export declare const getInviteRolesStep: import("@medusajs/framework/workflows-sdk").StepFunction<GetInviteRolesStepInput, any[]>;
//# sourceMappingURL=get-invite-roles.d.ts.map