import { RelationshipFilterConfig } from "@medusajs/framework/types";
import { ColumnDataType } from "./render-mode-mapper";
/**
 * Check if a field is filterable based on name, data type, and whether it's computed.
 */
export declare function isFilterable(fieldName: string, dataType: ColumnDataType, isComputed: boolean, semanticType?: string): boolean;
/**
 * Get available filter operators for a data type.
 */
export declare function getFilterOperators(dataType: ColumnDataType): string[];
/**
 * Filter configuration for a column.
 */
export interface ColumnFilterConfig {
    enabled: boolean;
    operators?: string[];
    enumValues?: string[];
    relationship?: RelationshipFilterConfig;
}
/**
 * Build the filter configuration for a column.
 */
export declare function buildFilterConfig(fieldName: string, dataType: ColumnDataType, isComputed: boolean, semanticType?: string, enumValues?: string[]): ColumnFilterConfig;
/**
 * Default field filter rules applied to all entities.
 */
export interface FieldFilterRules {
    /**
     * Field name suffixes to exclude.
     */
    excludeSuffixes: string[];
    /**
     * Field name prefixes to exclude.
     */
    excludePrefixes: string[];
    /**
     * Specific field names to exclude.
     */
    excludeFields: string[];
}
/**
 * Global default filter rules applied to all entities.
 */
export declare const DEFAULT_FIELD_FILTER_RULES: FieldFilterRules;
/**
 * Check if a field should be excluded based on filter rules.
 */
export declare function shouldExcludeField(fieldName: string, filterRules?: FieldFilterRules): boolean;
//# sourceMappingURL=filter-rules.d.ts.map