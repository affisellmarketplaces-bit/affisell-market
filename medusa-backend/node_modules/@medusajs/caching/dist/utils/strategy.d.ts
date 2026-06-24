import type { ICachingStrategy, ModuleJoinerConfig } from "@medusajs/framework/types";
import { type GraphQLSchema } from "@medusajs/framework/utils";
import { type CachingModuleService } from "../services";
import type { InjectedDependencies } from "../types";
import { EntityReference } from "./parser";
export declare class DefaultCacheStrategy implements ICachingStrategy {
    #private;
    constructor(container: InjectedDependencies, cacheModule: CachingModuleService);
    objectHash(input: any): string;
    onApplicationStart(schema: GraphQLSchema, joinerConfigs: ModuleJoinerConfig[]): Promise<void>;
    computeKey(input: object): Promise<string>;
    computeTags(input: object, options?: {
        entities?: EntityReference[];
        operation?: "created" | "updated" | "deleted";
    }): Promise<string[]>;
}
//# sourceMappingURL=strategy.d.ts.map