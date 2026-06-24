declare const IndexRelationService_base: {
    new <TContainer extends object = object, TEntity extends object = any>(container: TContainer): import("@medusajs/types").IMedusaInternalService<TEntity, TContainer>;
    setEventSubscriber(subscriber: import("@medusajs/framework/utils").MedusaMikroOrmEventSubscriber): void;
};
export declare class IndexRelationService extends IndexRelationService_base {
}
export {};
//# sourceMappingURL=index-relation.d.ts.map