import { Context, CreateFileDTO, FileDTO, FileTypes, FilterableFileProps, FindConfig, GetUploadFileUrlDTO, ModuleJoinerConfig, UploadFileUrlDTO } from "@medusajs/framework/types";
import type { Readable, Writable } from "stream";
import FileProviderService from "./file-provider-service";
type InjectedDependencies = {
    fileProviderService: FileProviderService;
};
export default class FileModuleService implements FileTypes.IFileModuleService {
    protected readonly fileProviderService_: FileProviderService;
    constructor({ fileProviderService }: InjectedDependencies);
    __joinerConfig(): ModuleJoinerConfig;
    getProvider(): FileProviderService;
    createFiles(data: CreateFileDTO[], sharedContext?: Context): Promise<FileDTO[]>;
    createFiles(data: CreateFileDTO, sharedContext?: Context): Promise<FileDTO>;
    getUploadFileUrls(data: GetUploadFileUrlDTO[], sharedContext?: Context): Promise<UploadFileUrlDTO[]>;
    getUploadFileUrls(data: GetUploadFileUrlDTO, sharedContext?: Context): Promise<UploadFileUrlDTO>;
    deleteFiles(ids: string[], sharedContext?: Context): Promise<void>;
    deleteFiles(id: string, sharedContext?: Context): Promise<void>;
    retrieveFile(id: string): Promise<FileDTO>;
    listFiles(filters?: FilterableFileProps, config?: FindConfig<FileDTO>, sharedContext?: Context): Promise<FileDTO[]>;
    listAndCountFiles(filters?: FilterableFileProps, config?: FindConfig<FileDTO>, sharedContext?: Context): Promise<[FileDTO[], number]>;
    /**
     * Get the file contents as a readable stream.
     *
     * @example
     * const stream = await fileModuleService.getAsStream("file_123")
     * writeable.pipe(stream)
     */
    getDownloadStream(id: string): Promise<Readable>;
    /**
     * Get the file contents as a Node.js Buffer
     *
     * @example
     * const contents = await fileModuleService.getAsBuffer("file_123")
     * contents.toString('utf-8')
     */
    getAsBuffer(id: string): Promise<Buffer>;
    /**
     * Get a writeable stream to upload a file.
     *
     * @example
     * const { writeStream, promise } = await fileModuleService.getUploadStream({
     *   filename: "test.csv",
     *   mimeType: "text/csv",
     * })
     *
     * stream.pipe(writeStream)
     * const result = await promise
     */
    getUploadStream(data: FileTypes.ProviderUploadStreamDTO): Promise<{
        writeStream: Writable;
        promise: Promise<FileTypes.ProviderFileResultDTO>;
        url: string;
        fileKey: string;
    }>;
}
export {};
//# sourceMappingURL=file-module-service.d.ts.map