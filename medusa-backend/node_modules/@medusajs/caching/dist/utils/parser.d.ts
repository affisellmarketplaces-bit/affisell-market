import { ModuleJoinerConfig } from "@medusajs/framework/types";
import { GraphQLSchema } from "graphql";
export interface EntityReference {
    type: string;
    id: string | number;
    field?: string;
    isInArray?: boolean;
}
export interface InvalidationEvent {
    entityType: string;
    entityId: string | number;
    relatedEntities: EntityReference[];
    cacheKeys: string[];
}
export declare class CacheInvalidationParser {
    private typeMap;
    private idPrefixToEntityName;
    constructor(schema: GraphQLSchema, joinerConfigs: ModuleJoinerConfig[]);
    /**
     * Parse an object to identify entities and their relationships
     */
    parseObjectForEntities(obj: any, parentType?: string, isInArray?: boolean): EntityReference[];
    /**
     * Detect entity type based on object structure and GraphQL type map
     */
    private detectEntityType;
    /**
     * Check if object structure matches GraphQL type fields
     */
    private objectMatchesType;
    /**
     * Get the expected type for a relationship field
     */
    private getRelationshipType;
    /**
     * Build invalidation events based on parsed entities
     */
    buildInvalidationEvents(entities: EntityReference[], operation?: "created" | "updated" | "deleted"): InvalidationEvent[];
    /**
     * Build list of cache keys that should be invalidated
     */
    private buildAffectedCacheKeys;
}
//# sourceMappingURL=parser.d.ts.map