import { Context, DAL, FindConfig, InferEntityType, OrderTypes, RepositoryService } from "@medusajs/framework/types";
import { ModulesSdkUtils } from "@medusajs/framework/utils";
import { Order } from "../models";
type InjectedDependencies = {
    orderRepository: DAL.RepositoryService;
};
declare const OrderService_base: {
    new <TContainer extends object = object, TEntity extends object = any>(container: TContainer): import("@medusajs/framework/types").IMedusaInternalService<TEntity, TContainer>;
    setEventSubscriber(subscriber: ModulesSdkUtils.MedusaMikroOrmEventSubscriber): void;
};
export default class OrderService extends OrderService_base {
    protected readonly orderRepository_: RepositoryService<InferEntityType<typeof Order>>;
    constructor(container: InjectedDependencies);
    retrieveOrderVersion<TEntityMethod = OrderTypes.OrderDTO>(id: string, version: number, config?: FindConfig<TEntityMethod>, sharedContext?: Context): Promise<typeof Order>;
}
export {};
//# sourceMappingURL=order-service.d.ts.map