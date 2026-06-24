import { DAL, InferEntityType, Logger, NotificationTypes } from "@medusajs/framework/types";
import { ModulesSdkUtils } from "@medusajs/framework/utils";
import { NotificationProvider } from "../models";
import { NotificationProviderRegistrationPrefix } from "../types";
type InjectedDependencies = {
    logger?: Logger;
    notificationProviderRepository: DAL.RepositoryService<InferEntityType<typeof NotificationProvider>>;
    [key: `${typeof NotificationProviderRegistrationPrefix}${string}`]: NotificationTypes.INotificationProvider;
};
type Provider = InferEntityType<typeof NotificationProvider>;
declare const NotificationProviderService_base: {
    new <TContainer extends object = object, TEntity extends object = any>(container: TContainer): import("@medusajs/framework/types").IMedusaInternalService<TEntity, TContainer>;
    setEventSubscriber(subscriber: ModulesSdkUtils.MedusaMikroOrmEventSubscriber): void;
};
export default class NotificationProviderService extends NotificationProviderService_base {
    #private;
    protected readonly notificationProviderRepository_: DAL.RepositoryService<InferEntityType<typeof NotificationProvider>>;
    protected providersCache: Map<string, InferEntityType<typeof NotificationProvider>>;
    constructor(container: InjectedDependencies);
    protected retrieveProviderRegistration(providerId: string): NotificationTypes.INotificationProvider;
    getProviderForChannels<TChannel = string | string[], TOutput = TChannel extends string[] ? Provider[] : Provider | undefined>(channels: TChannel): Promise<TOutput>;
    send(provider: InferEntityType<typeof NotificationProvider>, notification: NotificationTypes.ProviderSendNotificationDTO): Promise<NotificationTypes.ProviderSendNotificationResultsDTO>;
}
export {};
//# sourceMappingURL=notification-provider.d.ts.map