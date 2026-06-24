import { SettingsTypes } from "@medusajs/framework/types";
/**
 * Input data for updating property labels step.
 *
 * @since 2.13.7
 */
export interface UpdatePropertyLabelsStepInput {
    property_labels: {
        id: string;
        label?: string;
        description?: string;
    }[];
}
/**
 * Step ID for updating property labels step.
 *
 * @since 2.13.7
 */
export declare const updatePropertyLabelsStepId = "update-property-labels";
/**
 * Workflow step to update property labels.
 *
 * @since 2.13.7
 * @featureFlag view_configurations
 */
export declare const updatePropertyLabelsStep: import("@medusajs/framework/workflows-sdk").StepFunction<UpdatePropertyLabelsStepInput, SettingsTypes.PropertyLabelDTO[]>;
//# sourceMappingURL=update-property-label.d.ts.map