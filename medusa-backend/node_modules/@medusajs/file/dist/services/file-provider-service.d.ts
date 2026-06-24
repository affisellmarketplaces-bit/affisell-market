import { Constructor, FileTypes } from "@medusajs/framework/types";
import { FileProviderRegistrationPrefix } from "../types";
import type { Readable, Writable } from "stream";
type InjectedDependencies = {
    [key: `${typeof FileProviderRegistrationPrefix}${string}`]: FileTypes.IFileProvider;
};
export default class FileProviderService {
    protected readonly fileProvider_: FileTypes.IFileProvider;
    constructor(container: InjectedDependencies);
    static getRegistrationIdentifier(providerClass: Constructor<FileTypes.IFileProvider>, optionName?: string): string;
    upload(file: FileTypes.ProviderUploadFileDTO): Promise<FileTypes.ProviderFileResultDTO>;
    delete(fileData: FileTypes.ProviderDeleteFileDTO | FileTypes.ProviderDeleteFileDTO[]): Promise<void>;
    getPresignedDownloadUrl(fileData: FileTypes.ProviderGetFileDTO): Promise<string>;
    getPresignedUploadUrl(fileData: FileTypes.ProviderGetPresignedUploadUrlDTO): Promise<FileTypes.ProviderFileResultDTO>;
    getDownloadStream(fileData: FileTypes.ProviderGetFileDTO): Promise<Readable>;
    getAsBuffer(fileData: FileTypes.ProviderGetFileDTO): Promise<Buffer>;
    getUploadStream(fileData: FileTypes.ProviderUploadStreamDTO): Promise<{
        writeStream: Writable;
        promise: Promise<FileTypes.ProviderFileResultDTO>;
        url: string;
        fileKey: string;
    }>;
}
export {};
//# sourceMappingURL=file-provider-service.d.ts.map