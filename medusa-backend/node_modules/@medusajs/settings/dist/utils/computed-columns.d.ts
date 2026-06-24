import { RenderMode } from "./render-mode-mapper";
/**
 * Definition of a computed column.
 */
export interface ComputedColumnDefinition {
    /**
     * Unique identifier for the column (e.g., "customer_display").
     */
    id: string;
    /**
     * Display name for the column.
     */
    name: string;
    /**
     * Render mode/type for the column.
     */
    renderMode: RenderMode;
    /**
     * Fields required to render this column.
     */
    requiredFields: string[];
    /**
     * Optional fields that enhance the rendering.
     */
    optionalFields?: string[];
    /**
     * Entity names this column applies to.
     */
    entities: string[];
    /**
     * Whether this column should be visible by default.
     */
    defaultVisible?: boolean;
    /**
     * Description of the column.
     */
    description?: string;
    /**
     * Category for grouping columns (e.g., "relationship", "metadata", "computed").
     */
    category?: string;
}
/**
 * Built-in computed columns migrated from entity-mappings.ts.
 */
export declare const BUILTIN_COMPUTED_COLUMNS: ComputedColumnDefinition[];
/**
 * Registry for computed columns.
 * Allows registration of custom computed columns.
 */
export declare class ComputedColumnRegistry {
    private columns;
    constructor();
    /**
     * Register a computed column.
     */
    register(column: ComputedColumnDefinition): void;
    /**
     * Get a computed column by ID.
     */
    get(id: string): ComputedColumnDefinition | undefined;
    /**
     * Get all computed columns for an entity.
     */
    getForEntity(entityName: string): ComputedColumnDefinition[];
    /**
     * Get all registered computed columns.
     */
    getAll(): ComputedColumnDefinition[];
    /**
     * Check if a computed column exists.
     */
    has(id: string): boolean;
}
/**
 * Get the computed column registry singleton.
 */
export declare function getComputedColumnRegistry(): ComputedColumnRegistry;
//# sourceMappingURL=computed-columns.d.ts.map