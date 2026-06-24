import { Context, CustomerAddressDTO, CustomerDTO, CustomerGroupCustomerDTO, CustomerGroupDTO, CustomerTypes, DAL, ICustomerModuleService, InferEntityType, InternalModuleDeclaration, ModuleJoinerConfig, ModulesSdkTypes } from "@medusajs/framework/types";
import { Customer, CustomerAddress, CustomerGroup, CustomerGroupCustomer } from "../models";
type InjectedDependencies = {
    baseRepository: DAL.RepositoryService;
    customerService: ModulesSdkTypes.IMedusaInternalService<any>;
    customerAddressService: ModulesSdkTypes.IMedusaInternalService<any>;
    customerGroupService: ModulesSdkTypes.IMedusaInternalService<any>;
    customerGroupCustomerService: ModulesSdkTypes.IMedusaInternalService<any>;
};
declare const CustomerModuleService_base: import("@medusajs/framework/utils").MedusaServiceReturnType<{
    CustomerAddress: {
        dto: CustomerAddressDTO;
    };
    Customer: {
        dto: CustomerDTO;
    };
    CustomerGroup: {
        dto: CustomerGroupDTO;
    };
    CustomerGroupCustomer: {
        dto: CustomerGroupCustomerDTO;
    };
}>;
export default class CustomerModuleService extends CustomerModuleService_base implements ICustomerModuleService {
    protected readonly moduleDeclaration: InternalModuleDeclaration;
    protected baseRepository_: DAL.RepositoryService;
    protected customerService_: ModulesSdkTypes.IMedusaInternalService<InferEntityType<typeof Customer>>;
    protected customerAddressService_: ModulesSdkTypes.IMedusaInternalService<InferEntityType<typeof CustomerAddress>>;
    protected customerGroupService_: ModulesSdkTypes.IMedusaInternalService<InferEntityType<typeof CustomerGroup>>;
    protected customerGroupCustomerService_: ModulesSdkTypes.IMedusaInternalService<InferEntityType<typeof CustomerGroupCustomer>>;
    constructor({ baseRepository, customerService, customerAddressService, customerGroupService, customerGroupCustomerService, }: InjectedDependencies, moduleDeclaration: InternalModuleDeclaration);
    __joinerConfig(): ModuleJoinerConfig;
    createCustomers(data: CustomerTypes.CreateCustomerDTO, sharedContext?: Context): Promise<CustomerTypes.CustomerDTO>;
    createCustomers(data: CustomerTypes.CreateCustomerDTO[], sharedContext?: Context): Promise<CustomerTypes.CustomerDTO[]>;
    createCustomers_(dataOrArray: CustomerTypes.CreateCustomerDTO | CustomerTypes.CreateCustomerDTO[], sharedContext?: Context): Promise<InferEntityType<typeof Customer>[]>;
    updateCustomers(customerId: string, data: CustomerTypes.CustomerUpdatableFields, sharedContext?: Context): Promise<CustomerTypes.CustomerDTO>;
    updateCustomers(customerIds: string[], data: CustomerTypes.CustomerUpdatableFields, sharedContext?: Context): Promise<CustomerTypes.CustomerDTO[]>;
    updateCustomers(selector: CustomerTypes.FilterableCustomerProps, data: CustomerTypes.CustomerUpdatableFields, sharedContext?: Context): Promise<CustomerTypes.CustomerDTO[]>;
    protected updateCustomers_(idsOrSelector: string | string[] | CustomerTypes.FilterableCustomerProps, data: CustomerTypes.CustomerUpdatableFields, sharedContext?: Context): Promise<InferEntityType<typeof Customer>[] | InferEntityType<typeof Customer>>;
    createCustomerGroups(dataOrArrayOfData: CustomerTypes.CreateCustomerGroupDTO, sharedContext?: Context): Promise<CustomerTypes.CustomerGroupDTO>;
    createCustomerGroups(dataOrArrayOfData: CustomerTypes.CreateCustomerGroupDTO[], sharedContext?: Context): Promise<CustomerTypes.CustomerGroupDTO[]>;
    protected createCustomerGroups_(dataOrArrayOfData: CustomerTypes.CreateCustomerGroupDTO | CustomerTypes.CreateCustomerGroupDTO[], sharedContext?: Context): Promise<InferEntityType<typeof CustomerGroup>[] | InferEntityType<typeof CustomerGroup>>;
    updateCustomerGroups(groupId: string, data: CustomerTypes.CustomerGroupUpdatableFields, sharedContext?: Context): Promise<CustomerTypes.CustomerGroupDTO>;
    updateCustomerGroups(groupIds: string[], data: CustomerTypes.CustomerGroupUpdatableFields, sharedContext?: Context): Promise<CustomerTypes.CustomerGroupDTO[]>;
    updateCustomerGroups(selector: CustomerTypes.FilterableCustomerGroupProps, data: CustomerTypes.CustomerGroupUpdatableFields, sharedContext?: Context): Promise<CustomerTypes.CustomerGroupDTO[]>;
    protected updateCustomerGroups_(groupIdOrSelector: string | string[] | CustomerTypes.FilterableCustomerGroupProps, data: CustomerTypes.CustomerGroupUpdatableFields, sharedContext?: Context): Promise<InferEntityType<typeof CustomerGroup>[] | InferEntityType<typeof CustomerGroup>>;
    addCustomerToGroup(groupCustomerPair: CustomerTypes.GroupCustomerPair, sharedContext?: Context): Promise<{
        id: string;
    }>;
    addCustomerToGroup(groupCustomerPairs: CustomerTypes.GroupCustomerPair[], sharedContext?: Context): Promise<{
        id: string;
    }[]>;
    protected addCustomerToGroup_(data: CustomerTypes.GroupCustomerPair | CustomerTypes.GroupCustomerPair[], sharedContext?: Context): Promise<{
        id: string;
    } | {
        id: string;
    }[]>;
    createCustomerAddresses(addresses: CustomerTypes.CreateCustomerAddressDTO[], sharedContext?: Context): Promise<CustomerTypes.CustomerAddressDTO[]>;
    createCustomerAddresses(address: CustomerTypes.CreateCustomerAddressDTO, sharedContext?: Context): Promise<CustomerTypes.CustomerAddressDTO>;
    private createCustomerAddresses_;
    updateCustomerAddresses(addressId: string, data: CustomerTypes.UpdateCustomerAddressDTO, sharedContext?: Context): Promise<CustomerTypes.CustomerAddressDTO>;
    updateCustomerAddresses(addressIds: string[], data: CustomerTypes.UpdateCustomerAddressDTO, sharedContext?: Context): Promise<CustomerTypes.CustomerAddressDTO[]>;
    updateCustomerAddresses(selector: CustomerTypes.FilterableCustomerAddressProps, data: CustomerTypes.UpdateCustomerAddressDTO, sharedContext?: Context): Promise<CustomerTypes.CustomerAddressDTO[]>;
    protected updateCustomerAddresses_(addressIdOrSelector: string | string[] | CustomerTypes.FilterableCustomerAddressProps, data: CustomerTypes.UpdateCustomerAddressDTO, sharedContext?: Context): Promise<InferEntityType<typeof CustomerAddress>[] | InferEntityType<typeof CustomerAddress>>;
    removeCustomerFromGroup(groupCustomerPair: CustomerTypes.GroupCustomerPair, sharedContext?: Context): Promise<void>;
    removeCustomerFromGroup(groupCustomerPairs: CustomerTypes.GroupCustomerPair[], sharedContext?: Context): Promise<void>;
    protected removeCustomerFromGroup_(data: CustomerTypes.GroupCustomerPair | CustomerTypes.GroupCustomerPair[], sharedContext?: Context): Promise<void>;
}
export {};
//# sourceMappingURL=customer-module.d.ts.map