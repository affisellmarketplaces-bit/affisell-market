import { BatchWorkflowInput, BatchWorkflowOutput, SettingsTypes } from "@medusajs/framework/types";
/**
 * Input type for creating a property label in batch.
 *
 * @since 2.13.7
 */
export interface BatchPropertyLabelCreateInput {
    entity: string;
    property: string;
    label: string;
    description?: string;
}
/**
 * Input type for updating a property label in batch.
 *
 * @since 2.13.7
 */
export interface BatchPropertyLabelUpdateInput {
    id: string;
    label?: string;
    description?: string;
}
/**
 * The property labels to manage.
 *
 * @since 2.13.7
 */
export interface BatchPropertyLabelsWorkflowInput extends BatchWorkflowInput<BatchPropertyLabelCreateInput, BatchPropertyLabelUpdateInput> {
}
/**
 * Output type for batch property labels workflow.
 *
 * @since 2.13.7
 */
export type BatchPropertyLabelsWorkflowOutput = BatchWorkflowOutput<SettingsTypes.PropertyLabelDTO>;
/**
 * Workflow ID for batch property labels workflow.
 *
 * @since 2.13.7
 */
export declare const batchPropertyLabelsWorkflowId = "batch-property-labels";
/**
 * This workflow creates, updates, or deletes property labels in batch.
 *
 * @since 2.13.7
 * @featureFlag view_configurations
 */
export declare const batchPropertyLabelsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<BatchPropertyLabelsWorkflowInput, BatchPropertyLabelsWorkflowOutput, []>;
//# sourceMappingURL=batch-property-labels.d.ts.map