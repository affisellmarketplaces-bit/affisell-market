import { Context, DAL, FindConfig, InferEntityType, ProductTypes } from "@medusajs/framework/types";
import { MedusaService, ModulesSdkUtils } from "@medusajs/framework/utils";
import { ProductCategory } from "../models";
import { UpdateCategoryInput } from "../types";
type InjectedDependencies = {
    productCategoryRepository: DAL.TreeRepositoryService;
    productModuleService: ReturnType<typeof MedusaService>;
};
declare const ProductCategoryService_base: {
    new <TContainer extends object = object, TEntity extends object = any>(container: TContainer): import("@medusajs/framework/types").IMedusaInternalService<TEntity, TContainer>;
    setEventSubscriber(subscriber: ModulesSdkUtils.MedusaMikroOrmEventSubscriber): void;
};
export default class ProductCategoryService extends ProductCategoryService_base {
    protected readonly productCategoryRepository_: DAL.TreeRepositoryService;
    protected readonly container: InjectedDependencies;
    constructor(container: InjectedDependencies);
    retrieve(productCategoryId: string, config?: FindConfig<ProductTypes.ProductCategoryDTO>, sharedContext?: Context): Promise<InferEntityType<typeof ProductCategory>>;
    list(filters?: ProductTypes.FilterableProductCategoryProps, config?: FindConfig<ProductTypes.ProductCategoryDTO>, sharedContext?: Context): Promise<InferEntityType<typeof ProductCategory>[]>;
    listAndCount(filters?: ProductTypes.FilterableProductCategoryProps, config?: FindConfig<ProductTypes.ProductCategoryDTO>, sharedContext?: Context): Promise<[InferEntityType<typeof ProductCategory>[], number]>;
    create(data: ProductTypes.CreateProductCategoryDTO[], sharedContext?: Context): Promise<InferEntityType<typeof ProductCategory>[]>;
    update(data: UpdateCategoryInput[], sharedContext?: Context): Promise<InferEntityType<typeof ProductCategory>[]>;
    delete(ids: string[], sharedContext?: Context): Promise<string[]>;
    softDelete(ids: string[], sharedContext?: Context): Promise<Record<string, string[]> | void>;
    restore(ids: string[], sharedContext?: Context): Promise<Record<string, string[]> | void>;
}
export {};
//# sourceMappingURL=product-category.d.ts.map