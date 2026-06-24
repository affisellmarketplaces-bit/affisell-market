"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAuthAppMetadataWorkflow = exports.setAuthAppMetadataWorkflowId = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const set_auth_app_metadata_1 = require("../steps/set-auth-app-metadata");
exports.setAuthAppMetadataWorkflowId = "set-auth-app-metadata-workflow";
/**
 * This workflow sets the `app_metadata` property of an auth identity. This is useful to
 * associate a user (whether it's an admin user or customer) with an auth identity
 * that allows them to authenticate into Medusa.
 *
 * You can learn more about auth identites in
 * [this documentation](https://docs.medusajs.com/resources/commerce-modules/auth/auth-identity-and-actor-types).
 *
 * To use this for a custom actor type, check out [this guide](https://docs.medusajs.com/resources/commerce-modules/auth/create-actor-type)
 * that explains how to create a custom `manager` actor type and manage its users.
 *
 * @example
 * To associate an auth identity with an actor type (user, customer, or other actor types):
 *
 * ```ts
 * const { result } = await setAuthAppMetadataWorkflow(container).run({
 *   input: {
 *     authIdentityId: "au_1234",
 *     actorType: "user", // or `customer`, or custom type
 *     value: "user_123"
 *   }
 * })
 * ```
 *
 * To remove the association with an actor type, such as when deleting the user:
 *
 * ```ts
 * const { result } = await setAuthAppMetadataWorkflow(container).run({
 *   input: {
 *     authIdentityId: "au_1234",
 *     actorType: "user", // or `customer`, or custom type
 *     value: null
 *   }
 * })
 * ```
 */
exports.setAuthAppMetadataWorkflow = (0, workflows_sdk_1.createWorkflow)(exports.setAuthAppMetadataWorkflowId, (input) => {
    const authIdentity = (0, set_auth_app_metadata_1.setAuthAppMetadataStep)(input);
    return new workflows_sdk_1.WorkflowResponse(authIdentity);
});
//# sourceMappingURL=set-auth-app-metadata.js.map