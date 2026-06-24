import { SettingsTypes } from "@medusajs/framework/types";
/**
 * Input data for creating property labels step.
 *
 * @since 2.13.7
 */
export interface CreatePropertyLabelsStepInput {
    property_labels: {
        entity: string;
        property: string;
        label: string;
        description?: string;
    }[];
}
/**
 * Step ID for creating property labels step.
 *
 * @since 2.13.7
 */
export declare const createPropertyLabelsStepId = "create-property-labels";
/**
 * Workflow step to create property labels.
 *
 * @since 2.13.7
 * @featureFlag view_configurations
 */
export declare const createPropertyLabelsStep: import("@medusajs/framework/workflows-sdk").StepFunction<CreatePropertyLabelsStepInput, SettingsTypes.PropertyLabelDTO[]>;
//# sourceMappingURL=create-property-label.d.ts.map