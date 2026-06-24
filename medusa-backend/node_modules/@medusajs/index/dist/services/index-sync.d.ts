declare const IndexSyncService_base: {
    new <TContainer extends object = object, TEntity extends object = any>(container: TContainer): import("@medusajs/types").IMedusaInternalService<TEntity, TContainer>;
    setEventSubscriber(subscriber: import("@medusajs/framework/utils").MedusaMikroOrmEventSubscriber): void;
};
export declare class IndexSyncService extends IndexSyncService_base {
}
export {};
//# sourceMappingURL=index-sync.d.ts.map