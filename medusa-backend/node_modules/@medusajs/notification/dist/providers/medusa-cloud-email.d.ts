import { Logger, NotificationTypes } from "@medusajs/framework/types";
import { AbstractNotificationProviderService } from "@medusajs/framework/utils";
import { MedusaCloudEmailOptions } from "../types";
export declare class MedusaCloudEmailNotificationProvider extends AbstractNotificationProviderService {
    static identifier: string;
    protected options_: MedusaCloudEmailOptions;
    protected logger_: Logger;
    constructor({}: {}, options: MedusaCloudEmailOptions);
    send(notification: NotificationTypes.ProviderSendNotificationDTO): Promise<NotificationTypes.ProviderSendNotificationResultsDTO>;
}
//# sourceMappingURL=medusa-cloud-email.d.ts.map