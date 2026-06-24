import { Constructor, Context, IEventBusModuleService, IndexTypes, InternalModuleDeclaration, Logger, ModulesSdkTypes, RemoteQueryFunction } from "@medusajs/framework/types";
import { MikroOrmBaseRepository as BaseRepository, ContainerRegistrationKeys, Modules, ModulesSdkUtils } from "@medusajs/framework/utils";
import { DataSynchronizer } from "./data-synchronizer";
type InjectedDependencies = {
    logger: Logger;
    [Modules.EVENT_BUS]: IEventBusModuleService;
    storageProviderCtr: Constructor<IndexTypes.StorageProvider>;
    [ContainerRegistrationKeys.QUERY]: RemoteQueryFunction;
    storageProviderCtrOptions: unknown;
    baseRepository: BaseRepository;
    indexMetadataService: ModulesSdkTypes.IMedusaInternalService<any>;
    indexSyncService: ModulesSdkTypes.IMedusaInternalService<any>;
    dataSynchronizer: DataSynchronizer;
};
declare const IndexModuleService_base: ModulesSdkUtils.MedusaServiceReturnType<ModulesSdkUtils.ModelConfigurationsToConfigTemplate<{}>>;
export default class IndexModuleService extends IndexModuleService_base implements IndexTypes.IIndexService {
    #private;
    protected readonly moduleDeclaration: InternalModuleDeclaration;
    private static readonly SyncSubscribersDescriptor;
    private readonly baseRepository_;
    private readonly container_;
    private readonly moduleOptions_;
    protected readonly eventBusModuleService_: IEventBusModuleService;
    protected schemaObjectRepresentation_: IndexTypes.SchemaObjectRepresentation;
    protected schemaEntitiesMap_: Record<string, any>;
    protected readonly storageProviderCtr_: Constructor<IndexTypes.StorageProvider>;
    protected readonly storageProviderCtrOptions_: unknown;
    protected storageProvider_: IndexTypes.StorageProvider;
    private configurationChecker_;
    private get indexMetadataService_();
    private get indexSyncService_();
    private get dataSynchronizer_();
    private get logger_();
    constructor(container: InjectedDependencies, moduleOptions: IndexTypes.IndexModuleOptions, moduleDeclaration: InternalModuleDeclaration);
    __hooks: {
        onApplicationStart(this: IndexModuleService): Promise<void>;
    };
    protected onApplicationStart_(): Promise<void>;
    query<const TEntry extends string>(config: IndexTypes.IndexQueryConfig<TEntry>): Promise<IndexTypes.QueryResultSet<TEntry>>;
    protected registerListeners(): void;
    private buildSchemaObjectRepresentation_;
    /**
     * Example output:
     *
     *
     * ```json
     * [
     *   {
     *     "id": "prod_123",
     *     "entity": "product",
     *     "status": "pending",
     *     "fields": ["id"],
     *     "updated_at": "<timestamp of last indexed data>",
     *     "last_synced_key": "prod_4321"
     *   },
     *   ...
     * ]
     * ```
     * @returns Detailed index metadata with the last synced key for each entity
     */
    getInfo(sharedContext?: Context): Promise<IndexTypes.IndexInfo[]>;
    sync({ strategy }?: {
        strategy?: "full" | "reset";
    }): Promise<void>;
    /**
     * Continue the sync of the entities no matter their status
     * @param sharedContext
     * @returns
     */
    private continueSync;
    private fullSync;
    private resetSync;
}
export {};
//# sourceMappingURL=index-module-service.d.ts.map