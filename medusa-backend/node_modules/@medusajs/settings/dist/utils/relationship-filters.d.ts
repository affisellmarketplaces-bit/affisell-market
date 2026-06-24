/**
 * Relationship filter configuration utilities.
 * Configures dropdown filters for relationship fields.
 */
import { SchemaTypeMap } from "./entity-discovery";
/**
 * Configuration for a relationship filter.
 */
export interface RelationshipFilterDefinition {
    /**
     * The relationship field (e.g., "sales_channels").
     */
    field: string;
    /**
     * Related entity name (e.g., "SalesChannel").
     */
    relatedEntity: string;
    /**
     * Field to use as filter value (e.g., "id").
     */
    valueField: string;
    /**
     * Field to display in dropdown (e.g., "name").
     */
    displayField: string;
    /**
     * Whether multiple selection is allowed.
     */
    multiple: boolean;
    /**
     * API endpoint to fetch options (e.g., "/admin/sales-channels").
     */
    endpoint?: string;
}
/**
 * Relationship filter config as returned in column metadata.
 */
export interface RelationshipFilterConfig {
    entity: string;
    value_field: string;
    display_field: string;
    multiple: boolean;
    endpoint: string;
}
/**
 * Maps entity names to their admin API endpoints.
 *
 * Most endpoints follow the convention: EntityName → /admin/{kebab-case-plural}
 * e.g., SalesChannel → /admin/sales-channels
 *
 * Only entities that DON'T follow this convention need to be listed here.
 * The `inferOptionsEndpoint` function will auto-generate endpoints for unlisted entities.
 */
export declare const ENTITY_ENDPOINT_MAP: Record<string, string>;
/**
 * Infer the API endpoint for fetching filter options.
 */
export declare function inferOptionsEndpoint(entityName: string): string;
/**
 * Built-in relationship filter configurations for known entities.
 */
export declare const RELATIONSHIP_FILTER_OVERRIDES: Record<string, RelationshipFilterDefinition[]>;
/**
 * Get the relationship filter configuration for a field.
 */
export declare function getRelationshipFilterConfig(entityName: string, fieldName: string, relatedEntityName: string, isMultiple: boolean, schemaTypeMap?: SchemaTypeMap): RelationshipFilterConfig | null;
//# sourceMappingURL=relationship-filters.d.ts.map