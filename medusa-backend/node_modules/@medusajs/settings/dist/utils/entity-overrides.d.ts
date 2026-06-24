import { FieldFilterRules } from "./filter-rules";
import { ComputedColumnDefinition } from "./computed-columns";
/**
 * Override configuration for an entity.
 * Allows customizing how columns are generated and displayed.
 */
export interface EntityOverride {
    /**
     * Specific field names to exclude.
     */
    excludeFields?: string[];
    /**
     * Field name suffixes to exclude.
     */
    excludeSuffixes?: string[];
    /**
     * Field name prefixes to exclude.
     */
    excludePrefixes?: string[];
    /**
     * Fields to show by default (in order).
     */
    defaultVisibleFields?: string[];
    /**
     * Custom ordering for fields (field name -> order number).
     * Lower numbers appear first.
     */
    fieldOrdering?: Record<string, number>;
    /**
     * Additional GraphQL types to include fields from.
     */
    additionalTypes?: string[];
    /**
     * Fields that should be displayed as columns but cannot be filtered on.
     * Use for fields that exist on the entity (e.g. computed enums like
     * `payment_status`) but are not accepted by the corresponding list API.
     * Dotted paths are supported (e.g. `customer.email`) to target
     * nested-relationship scalar fields, matching the convention used by
     * `defaultVisibleFields` and `fieldOrdering`.
     */
    nonFilterableFields?: string[];
    /**
     * Computed columns specific to this entity.
     * Note: Computed columns can also be defined in the ComputedColumnRegistry.
     */
    computedColumns?: ComputedColumnDefinition[];
}
/**
 * Built-in entity overrides for core Medusa entities.
 * These provide backward compatibility and sensible defaults.
 */
export declare const BUILTIN_ENTITY_OVERRIDES: Record<string, EntityOverride>;
/**
 * Registry for entity overrides.
 * Allows registration of custom overrides for any entity.
 */
export declare class EntityOverrideRegistry {
    private overrides;
    constructor();
    /**
     * Register an override for an entity.
     * If an override already exists, it will be merged (new values take precedence).
     */
    register(entityName: string, override: EntityOverride): void;
    /**
     * Get the override for an entity.
     */
    get(entityName: string): EntityOverride | undefined;
    /**
     * Check if an entity has an override.
     */
    has(entityName: string): boolean;
    /**
     * Get all registered entity names.
     */
    getEntityNames(): string[];
    /**
     * Get all overrides as a record.
     */
    getAll(): Record<string, EntityOverride>;
}
/**
 * Get the entity override registry singleton.
 */
export declare function getEntityOverrideRegistry(): EntityOverrideRegistry;
/**
 * Reset the entity override registry (for testing purposes).
 */
export declare function resetEntityOverrideRegistry(): void;
/**
 * Get the entity override for an entity name.
 * Returns undefined if no override exists.
 */
export declare function getEntityOverride(entityName: string): EntityOverride | undefined;
/**
 * Check if an entity has custom overrides.
 */
export declare function hasEntityOverride(entityName: string): boolean;
/**
 * Get the field filter rules for an entity, merging with defaults.
 * @param entityName - The entity name (used if override is not provided)
 * @param override - Optional pre-resolved override to use instead of looking up by entity name
 */
export declare function getFieldFilterRules(entityName: string, override?: EntityOverride): FieldFilterRules;
/**
 * Get the default visible fields for an entity.
 * @param entityName - The entity name (used if override is not provided)
 * @param override - Optional pre-resolved override to use instead of looking up by entity name
 */
export declare function getDefaultVisibleFields(entityName: string, override?: EntityOverride): string[];
/**
 * Get the field ordering for an entity.
 * @param entityName - The entity name (used if override is not provided)
 * @param override - Optional pre-resolved override to use instead of looking up by entity name
 */
export declare function getFieldOrdering(entityName: string, override?: EntityOverride): Record<string, number>;
/**
 * Get additional types to include for an entity.
 * @param entityName - The entity name (used if override is not provided)
 * @param override - Optional pre-resolved override to use instead of looking up by entity name
 */
export declare function getAdditionalTypes(entityName: string, override?: EntityOverride): string[];
/**
 * Get fields that should be displayed but not filterable for an entity.
 * @param entityName - The entity name (used if override is not provided)
 * @param override - Optional pre-resolved override to use instead of looking up by entity name
 */
export declare function getNonFilterableFields(entityName: string, override?: EntityOverride): string[];
/**
 * Map from plural/route names to entity names for backward compatibility.
 */
export declare const ROUTE_TO_ENTITY_MAP: Record<string, string>;
/**
 * Get the entity name from a route/plural name.
 */
export declare function entityNameFromRoute(routeName: string): string | undefined;
/**
 * @deprecated Use `getEntityOverrideRegistry()` instead.
 * Backward compatibility export - returns a snapshot of current overrides.
 */
export declare const ENTITY_OVERRIDES: Record<string, EntityOverride>;
//# sourceMappingURL=entity-overrides.d.ts.map