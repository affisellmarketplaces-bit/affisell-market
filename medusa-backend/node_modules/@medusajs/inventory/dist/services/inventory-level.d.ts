import { Context } from "@medusajs/framework/types";
import { BigNumber, ModulesSdkUtils } from "@medusajs/framework/utils";
import { InventoryLevelRepository } from "../repositories";
type InjectedDependencies = {
    inventoryLevelRepository: InventoryLevelRepository;
};
declare const InventoryLevelService_base: {
    new <TContainer extends object = object, TEntity extends object = any>(container: TContainer): import("@medusajs/framework/types").IMedusaInternalService<TEntity, TContainer>;
    setEventSubscriber(subscriber: ModulesSdkUtils.MedusaMikroOrmEventSubscriber): void;
};
export default class InventoryLevelService extends InventoryLevelService_base {
    protected readonly inventoryLevelRepository: InventoryLevelRepository;
    constructor(container: InjectedDependencies);
    retrieveStockedQuantity(inventoryItemId: string, locationIds: string[] | string, context?: Context): Promise<BigNumber>;
    getAvailableQuantity(inventoryItemId: string, locationIds: string[] | string, context?: Context): Promise<BigNumber>;
    getReservedQuantity(inventoryItemId: string, locationIds: string[] | string, context?: Context): Promise<BigNumber>;
}
export {};
//# sourceMappingURL=inventory-level.d.ts.map