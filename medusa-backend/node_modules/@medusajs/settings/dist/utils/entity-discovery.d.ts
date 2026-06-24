import { GraphQLObjectType, isListType, isNonNullType } from "@medusajs/framework/utils";
/**
 * Joiner config interface (subset of what we need).
 */
export interface JoinerConfig {
    serviceName?: string;
    schema?: string;
    primaryKeys?: string[];
    linkableKeys?: Record<string, string>;
    isLink?: boolean;
}
/**
 * Convert PascalCase to kebab-case with pluralization.
 */
export declare function toKebabCasePlural(name: string): string;
/**
 * Discovered entity metadata.
 */
export interface DiscoveredEntity {
    name: string;
    pluralName: string;
    module: string;
    graphqlType: string;
    schema: string;
    primaryKeys: string[];
    linkableKeys: Record<string, string>;
}
/**
 * Schema type map from merged GraphQL schemas.
 */
export interface SchemaTypeMap {
    [key: string]: GraphQLObjectType | any;
}
/**
 * Entity info as returned by the API.
 */
export interface EntityInfo {
    name: string;
    pluralName: string;
    module: string;
    propertyCount: number;
    hasOverrides: boolean;
}
/**
 * Service for discovering entities from joiner configs.
 * Unlike the API version, this service requires explicit initialization
 * with joiner configs (typically in onApplicationStart hook).
 */
export declare class EntityDiscoveryService {
    private schemaTypeMap;
    private discoveredEntities;
    private joinerConfigs;
    private initialized;
    /**
     * Initialize the service with joiner configs.
     * Should be called from onApplicationStart hook.
     */
    initialize(joinerConfigs: JoinerConfig[]): void;
    /**
     * Check if the service has been initialized.
     */
    isInitialized(): boolean;
    /**
     * Build and cache the merged schema type map.
     */
    getSchemaTypeMap(): SchemaTypeMap;
    /**
     * Discover all entities from joiner configs.
     * Filters out link configs and returns metadata about each entity.
     */
    discoverEntities(): DiscoveredEntity[];
    /**
     * Get an entity by name.
     * Supports PascalCase, kebab-case, snake_case, and plural forms.
     */
    getEntity(name: string): DiscoveredEntity | null;
    /**
     * Check if an entity exists by name.
     */
    hasEntity(name: string): boolean;
    /**
     * Get the GraphQL type for an entity.
     */
    getEntityType(entityName: string): GraphQLObjectType | null;
    /**
     * Get fields for an entity type.
     */
    getEntityFields(entityName: string): string[];
    /**
     * Get entity info for the API response.
     */
    getEntityInfo(entity: DiscoveredEntity, hasOverrides: boolean): EntityInfo;
    /**
     * Clear the cache (useful for testing).
     */
    clearCache(): void;
}
/**
 * Helper to get the underlying type from wrapped types (NonNull, List).
 */
export declare function getUnderlyingType(type: any): any;
/**
 * Helper to check if a field type is an array/list.
 */
export declare function isArrayField(type: any): boolean;
/**
 * Helper to check if a field is a single relationship (many-to-one, one-to-one).
 */
export declare function isSingleRelationship(type: any): boolean;
export { isListType, isNonNullType };
//# sourceMappingURL=entity-discovery.d.ts.map