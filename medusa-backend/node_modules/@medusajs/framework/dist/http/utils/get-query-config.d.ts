import { FindConfig, QueryConfig, RequestQueryFields } from "@medusajs/types";
import { PolicyDefinition } from "@medusajs/utils";
import { AuthContext, MedusaRequest } from "../types";
export declare function pickByConfig<TModel>(obj: TModel | TModel[], config: FindConfig<TModel>): Partial<TModel> | Partial<TModel>[];
export declare function prepareListQuery<T extends RequestQueryFields, TEntity>(validated: T, queryConfig?: QueryConfig<TEntity> & {
    restricted?: string[];
}, req?: MedusaRequest & {
    policies?: PolicyDefinition[];
    auth_context?: AuthContext;
}): Promise<{
    listConfig: {
        select: string[] | undefined;
        relations: string[];
        skip: number;
        take: number;
        order: import("@medusajs/utils").Order | undefined;
        withDeleted: boolean | undefined;
    };
    remoteQueryConfig: {
        fields: string[];
        pagination: {
            skip: number;
            take: number;
            order: import("@medusajs/utils").Order | undefined;
        } | {
            skip?: undefined;
            take?: undefined;
            order?: undefined;
        };
        withDeleted: boolean | undefined;
        entity?: string | NonNullable<TEntity> | undefined;
    };
}>;
export declare function prepareRetrieveQuery<T extends RequestQueryFields, TEntity>(validated: T, queryConfig?: QueryConfig<TEntity> & {
    restricted?: string[];
}, req?: MedusaRequest & {
    policies?: PolicyDefinition[];
    auth_context?: AuthContext;
}): Promise<{
    retrieveConfig: {
        select: string[] | undefined;
        relations: string[];
    };
    remoteQueryConfig: {
        fields: string[];
        pagination: {};
        withDeleted: boolean | undefined;
    };
}>;
//# sourceMappingURL=get-query-config.d.ts.map