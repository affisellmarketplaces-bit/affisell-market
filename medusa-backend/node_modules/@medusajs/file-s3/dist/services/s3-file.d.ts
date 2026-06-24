import { S3Client } from "@aws-sdk/client-s3";
import { FileTypes, Logger, S3FileServiceOptions } from "@medusajs/framework/types";
import { AbstractFileProviderService } from "@medusajs/framework/utils";
import { Readable, Writable } from "stream";
type InjectedDependencies = {
    logger: Logger;
};
interface S3FileServiceConfig {
    fileUrl: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    authenticationMethod?: "access-key" | "s3-iam-role";
    region: string;
    bucket: string;
    prefix?: string;
    endpoint?: string;
    cacheControl?: string;
    downloadFileDuration?: number;
    additionalClientConfig?: Record<string, any>;
}
export declare class S3FileService extends AbstractFileProviderService {
    static identifier: string;
    protected config_: S3FileServiceConfig;
    protected logger_: Logger;
    protected client_: S3Client;
    constructor({ logger }: InjectedDependencies, options: S3FileServiceOptions);
    protected getClient(): S3Client;
    upload(file: FileTypes.ProviderUploadFileDTO): Promise<FileTypes.ProviderFileResultDTO>;
    getUploadStream(fileData: FileTypes.ProviderUploadStreamDTO): Promise<{
        writeStream: Writable;
        promise: Promise<FileTypes.ProviderFileResultDTO>;
        url: string;
        fileKey: string;
    }>;
    delete(files: FileTypes.ProviderDeleteFileDTO | FileTypes.ProviderDeleteFileDTO[]): Promise<void>;
    getPresignedDownloadUrl(fileData: FileTypes.ProviderGetFileDTO): Promise<string>;
    getPresignedUploadUrl(fileData: FileTypes.ProviderGetPresignedUploadUrlDTO): Promise<FileTypes.ProviderFileResultDTO>;
    getDownloadStream(file: FileTypes.ProviderGetFileDTO): Promise<Readable>;
    getAsBuffer(file: FileTypes.ProviderGetFileDTO): Promise<Buffer>;
}
export {};
//# sourceMappingURL=s3-file.d.ts.map