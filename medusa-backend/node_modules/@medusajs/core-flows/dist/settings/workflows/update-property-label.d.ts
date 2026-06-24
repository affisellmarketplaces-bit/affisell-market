import { SettingsTypes } from "@medusajs/framework/types";
export interface UpdatePropertyLabelsWorkflowInput {
    property_labels: {
        id: string;
        label?: string;
        description?: string;
    }[];
}
export declare const updatePropertyLabelsWorkflowId = "update-property-labels";
/**
 * @since 2.13.2
 * @featureFlag view_configurations
 */
export declare const updatePropertyLabelsWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<UpdatePropertyLabelsWorkflowInput, SettingsTypes.PropertyLabelDTO[], []>;
//# sourceMappingURL=update-property-label.d.ts.map