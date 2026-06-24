declare const IndexMetadataService_base: {
    new <TContainer extends object = object, TEntity extends object = any>(container: TContainer): import("@medusajs/types").IMedusaInternalService<TEntity, TContainer>;
    setEventSubscriber(subscriber: import("@medusajs/framework/utils").MedusaMikroOrmEventSubscriber): void;
};
export declare class IndexMetadataService extends IndexMetadataService_base {
}
export {};
//# sourceMappingURL=index-metadata.d.ts.map