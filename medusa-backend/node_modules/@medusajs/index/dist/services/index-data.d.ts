declare const IndexDataService_base: {
    new <TContainer extends object = object, TEntity extends object = any>(container: TContainer): import("@medusajs/types").IMedusaInternalService<TEntity, TContainer>;
    setEventSubscriber(subscriber: import("@medusajs/framework/utils").MedusaMikroOrmEventSubscriber): void;
};
export declare class IndexDataService extends IndexDataService_base {
}
export {};
//# sourceMappingURL=index-data.d.ts.map