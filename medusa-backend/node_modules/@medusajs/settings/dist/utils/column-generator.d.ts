import { SettingsTypes } from "@medusajs/framework/types";
import { ComputedColumnDefinition } from "./computed-columns";
import { DiscoveredEntity, EntityDiscoveryService } from "./entity-discovery";
import { EntityOverride } from "./entity-overrides";
export type ViewConfigurationColumn = SettingsTypes.ViewConfigurationColumnDTO;
/**
 * Property label data for customizing column names.
 */
export interface PropertyLabel {
    id: string;
    entity: string;
    property: string;
    label: string;
    description?: string | null;
}
/**
 * Generate columns for an entity using the entity discovery service.
 */
export declare function generateEntityColumns(entityDiscovery: EntityDiscoveryService, entityKey: string, propertyLabels?: Map<string, PropertyLabel>, customOverride?: EntityOverride): ViewConfigurationColumn[] | null;
/**
 * Convert a computed column definition to an AdminColumn.
 */
export declare function computedColumnToAdminColumn(column: ComputedColumnDefinition, entity: DiscoveredEntity, defaultOrder?: number, label?: PropertyLabel): ViewConfigurationColumn;
//# sourceMappingURL=column-generator.d.ts.map