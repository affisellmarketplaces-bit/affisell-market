/**
 * Input data for deleting property labels step.
 *
 * @since 2.13.7
 */
export interface DeletePropertyLabelsStepInput {
    ids: string[];
}
/**
 * Step ID for deleting property labels step.
 *
 * @since 2.13.7
 */
export declare const deletePropertyLabelsStepId = "delete-property-labels";
/**
 * Workflow step to delete property labels.
 *
 * @since 2.13.7
 * @featureFlag view_configurations
 */
export declare const deletePropertyLabelsStep: import("@medusajs/framework/workflows-sdk").StepFunction<DeletePropertyLabelsStepInput, void>;
//# sourceMappingURL=delete-property-labels.d.ts.map