import { SettingsTypes } from "@medusajs/framework/types";
export interface CreatePropertyLabelsWorkflowInput {
    property_labels: {
        entity: string;
        property: string;
        label: string;
        description?: string;
    }[];
}
export declare const createPropertyLabelsWorkflowId = "create-property-labels";
/**
 * @since 2.13.2
 * @featureFlag view_configurations
 */
export declare const createPropertyLabelsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<CreatePropertyLabelsWorkflowInput, SettingsTypes.PropertyLabelDTO[], []>;
//# sourceMappingURL=create-property-label.d.ts.map