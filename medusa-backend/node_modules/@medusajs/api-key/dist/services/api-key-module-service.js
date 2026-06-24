"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyModuleService = void 0;
const types_1 = require("@medusajs/framework/types");
const utils_1 = require("@medusajs/framework/utils");
const _models_1 = require("../models");
const crypto_1 = __importDefault(require("crypto"));
const util_1 = __importDefault(require("util"));
const joiner_config_1 = require("../joiner-config");
const scrypt = util_1.default.promisify(crypto_1.default.scrypt);
class ApiKeyModuleService extends (0, utils_1.MedusaService)({ ApiKey: _models_1.ApiKey }) {
    constructor({ baseRepository, apiKeyService }, moduleDeclaration) {
        // @ts-ignore
        super(...arguments);
        this.moduleDeclaration = moduleDeclaration;
        this.baseRepository_ = baseRepository;
        this.apiKeyService_ = apiKeyService;
    }
    __joinerConfig() {
        return joiner_config_1.joinerConfig;
    }
    // @ts-expect-error
    async deleteApiKeys(ids, sharedContext = {}) {
        return await this.deleteApiKeys_(ids, sharedContext);
    }
    async deleteApiKeys_(ids, sharedContext = {}) {
        const apiKeyIds = Array.isArray(ids) ? ids : [ids];
        const unrevokedApiKeys = (await this.apiKeyService_.list({
            id: ids,
            $or: [
                { revoked_at: { $eq: null } },
                { revoked_at: { $gt: new Date() } },
            ],
        }, { select: ["id"] }, sharedContext)).map((apiKey) => apiKey.id);
        if ((0, utils_1.isPresent)(unrevokedApiKeys)) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, `Cannot delete api keys that are not revoked - ${unrevokedApiKeys.join(", ")}`);
        }
        return await super.deleteApiKeys(apiKeyIds, sharedContext);
    }
    //@ts-expect-error
    async createApiKeys(data, sharedContext = {}) {
        const [createdApiKeys, generatedTokens] = await this.createApiKeys_(Array.isArray(data) ? data : [data], sharedContext);
        const serializedResponse = await this.baseRepository_.serialize(createdApiKeys, {
            populate: true,
        });
        // When creating we want to return the raw token, as this will be the only time the user will be able to take note of it for future use.
        const responseWithRawToken = serializedResponse.map((key) => ({
            ...key,
            token: generatedTokens.find((t) => t.hashedToken === key.token)?.rawToken ??
                key.token,
            salt: undefined,
        }));
        return Array.isArray(data) ? responseWithRawToken : responseWithRawToken[0];
    }
    async createApiKeys_(data, sharedContext = {}) {
        const normalizedInput = [];
        const generatedTokens = [];
        for (const key of data) {
            let tokenData;
            if (key.type === utils_1.ApiKeyType.PUBLISHABLE) {
                tokenData = ApiKeyModuleService.generatePublishableKey();
            }
            else {
                tokenData = await ApiKeyModuleService.generateSecretKey();
            }
            generatedTokens.push(tokenData);
            normalizedInput.push({
                ...key,
                token: tokenData.hashedToken,
                salt: tokenData.salt,
                redacted: tokenData.redacted,
            });
        }
        const createdApiKeys = await this.apiKeyService_.create(normalizedInput, sharedContext);
        return [createdApiKeys, generatedTokens];
    }
    async upsertApiKeys(data, sharedContext = {}) {
        const result = await this.upsertApiKeys_(data, sharedContext);
        return await this.baseRepository_.serialize(result);
    }
    async upsertApiKeys_(data, sharedContext = {}) {
        const input = Array.isArray(data) ? data : [data];
        const forUpdate = input.filter((apiKey) => !!apiKey.id);
        const forCreate = input.filter((apiKey) => !apiKey.id);
        const operations = [];
        if (forCreate.length) {
            const op = async () => {
                const [createdApiKeys, generatedTokens] = await this.createApiKeys_(forCreate, sharedContext);
                const serializedResponse = await this.baseRepository_.serialize(createdApiKeys);
                return serializedResponse.map((key) => ({
                    ...key,
                    token: generatedTokens.find((t) => t.hashedToken === key.token)
                        ?.rawToken ?? key.token,
                    salt: undefined,
                }));
            };
            operations.push(op());
        }
        if (forUpdate.length) {
            const op = async () => {
                return await this.updateApiKeys_(forUpdate, sharedContext);
            };
            operations.push(op());
        }
        const result = (await (0, utils_1.promiseAll)(operations)).flat();
        return Array.isArray(data) ? result : result[0];
    }
    //@ts-expect-error
    async updateApiKeys(idOrSelector, data, sharedContext = {}) {
        let normalizedInput = await this.normalizeUpdateInput_(idOrSelector, data, sharedContext);
        const updatedApiKeys = await this.updateApiKeys_(normalizedInput, sharedContext);
        const serializedResponse = await this.baseRepository_.serialize(updatedApiKeys.map(omitToken), {
            populate: true,
        });
        return (0, utils_1.isString)(idOrSelector) ? serializedResponse[0] : serializedResponse;
    }
    async updateApiKeys_(normalizedInput, sharedContext = {}) {
        const updateRequest = normalizedInput.map((k) => ({
            id: k.id,
            title: k.title,
        }));
        const updatedApiKeys = await this.apiKeyService_.update(updateRequest, sharedContext);
        return updatedApiKeys;
    }
    // @ts-expect-error
    async retrieveApiKey(id, config, sharedContext) {
        const apiKey = await this.apiKeyService_.retrieve(id, config, sharedContext);
        return await this.baseRepository_.serialize(omitToken(apiKey), {
            populate: true,
        });
    }
    //@ts-expect-error
    async listApiKeys(filters, config, sharedContext) {
        const apiKeys = await this.apiKeyService_.list(filters, config, sharedContext);
        return await this.baseRepository_.serialize(apiKeys.map(omitToken), {
            populate: true,
        });
    }
    //@ts-expect-error
    async listAndCountApiKeys(filters, config, sharedContext) {
        const [apiKeys, count] = await this.apiKeyService_.listAndCount(filters, config, sharedContext);
        return [
            await this.baseRepository_.serialize(apiKeys.map(omitToken), {
                populate: true,
            }),
            count,
        ];
    }
    async revoke(idOrSelector, data, sharedContext = {}) {
        const normalizedInput = await this.normalizeUpdateInput_(idOrSelector, data, sharedContext);
        const revokedApiKeys = await this.revoke_(normalizedInput, sharedContext);
        const serializedResponse = await this.baseRepository_.serialize(revokedApiKeys.map(omitToken), {
            populate: true,
        });
        return (0, utils_1.isString)(idOrSelector) ? serializedResponse[0] : serializedResponse;
    }
    async revoke_(normalizedInput, sharedContext = {}) {
        await this.validateRevokeApiKeys_(normalizedInput);
        const updateRequest = normalizedInput.map((k) => {
            const revokedAt = new Date();
            if (k.revoke_in && k.revoke_in > 0) {
                revokedAt.setSeconds(revokedAt.getSeconds() + k.revoke_in);
            }
            return {
                id: k.id,
                revoked_at: revokedAt,
                revoked_by: k.revoked_by,
            };
        });
        const revokedApiKeys = await this.apiKeyService_.update(updateRequest, sharedContext);
        return revokedApiKeys;
    }
    async authenticate(token, sharedContext = {}) {
        const result = await this.authenticate_(token, sharedContext);
        if (!result) {
            return false;
        }
        const serialized = await this.baseRepository_.serialize(result, {
            populate: true,
        });
        return serialized;
    }
    async authenticate_(token, sharedContext = {}) {
        const secretKeys = await this.apiKeyService_.list({
            type: utils_1.ApiKeyType.SECRET,
            // There could be many unrevoked keys at the same time, so we narrow the list down by the redacted key.
            // Note that the redacted key doesn't guarantee uniqueness and is not an authentication check, but just an optimization.
            redacted: redactKey(token),
            // If the revoke date is set in the future, it means the key is still valid.
            $or: [
                { revoked_at: { $eq: null } },
                { revoked_at: { $gt: new Date() } },
            ],
        }, {
            take: undefined,
        }, sharedContext);
        const matches = await (0, utils_1.promiseAll)(secretKeys.map(async (dbKey) => {
            const hashedInput = await ApiKeyModuleService.calculateHash(token, dbKey.salt);
            if (hashedInput === dbKey.token) {
                return dbKey;
            }
            return undefined;
        }));
        const matchedKeys = matches.filter((match) => !!match);
        if (!matchedKeys.length) {
            return false;
        }
        return matchedKeys[0];
    }
    async normalizeUpdateInput_(idOrSelector, data, sharedContext = {}) {
        let normalizedInput = [];
        if ((0, utils_1.isString)(idOrSelector)) {
            normalizedInput = [{ id: idOrSelector, ...data }];
        }
        if ((0, utils_1.isObject)(idOrSelector)) {
            const apiKeys = await this.apiKeyService_.list(idOrSelector, {}, sharedContext);
            normalizedInput = apiKeys.map((apiKey) => ({
                id: apiKey.id,
                ...data,
            }));
        }
        return normalizedInput;
    }
    async validateRevokeApiKeys_(data, sharedContext = {}) {
        if (!data.length) {
            return;
        }
        if (data.some((k) => !k.id)) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `You must provide an api key id field when revoking a key.`);
        }
        if (data.some((k) => !k.revoked_by)) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `You must provide a revoked_by field when revoking a key.`);
        }
        const revokedApiKeys = await this.apiKeyService_.list({
            id: data.map((k) => k.id),
            type: utils_1.ApiKeyType.SECRET,
            revoked_at: { $lt: new Date() },
        }, {}, sharedContext);
        if (revokedApiKeys.length) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `There are ${revokedApiKeys.length} secret keys that are already revoked.`);
        }
    }
    // These are public keys, so there is no point hashing them.
    static generatePublishableKey() {
        const token = "pk_" + crypto_1.default.randomBytes(32).toString("hex");
        return {
            rawToken: token,
            hashedToken: token,
            salt: "",
            redacted: redactKey(token),
        };
    }
    static async generateSecretKey() {
        const token = "sk_" + crypto_1.default.randomBytes(32).toString("hex");
        const salt = crypto_1.default.randomBytes(16).toString("hex");
        const hashed = await this.calculateHash(token, salt);
        return {
            rawToken: token,
            hashedToken: hashed,
            salt,
            redacted: redactKey(token),
        };
    }
    static async calculateHash(token, salt) {
        return (await scrypt(token, salt, 64)).toString("hex");
    }
}
exports.ApiKeyModuleService = ApiKeyModuleService;
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "deleteApiKeys", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "deleteApiKeys_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    //@ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "createApiKeys", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "createApiKeys_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "upsertApiKeys", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "upsertApiKeys_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)()
    //@ts-expect-error
    ,
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "updateApiKeys", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "updateApiKeys_", null);
__decorate([
    (0, utils_1.InjectManager)()
    // @ts-expect-error
    ,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "retrieveApiKey", null);
__decorate([
    (0, utils_1.InjectManager)()
    //@ts-expect-error
    ,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "listApiKeys", null);
__decorate([
    (0, utils_1.InjectManager)()
    //@ts-expect-error
    ,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "listAndCountApiKeys", null);
__decorate([
    (0, utils_1.InjectManager)(),
    (0, utils_1.EmitEvents)(),
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "revoke", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "revoke_", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "authenticate", null);
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ApiKeyModuleService.prototype, "authenticate_", null);
// We are mutating the object here as what microORM relies on non-enumerable fields for serialization, among other things.
const omitToken = (
// We have to make salt optional before deleting it (and we do want it required in the DB)
key) => {
    key.token = key.type === utils_1.ApiKeyType.SECRET ? "" : key.token;
    delete key.salt;
    return key;
};
const redactKey = (key) => {
    return [key.slice(0, 6), key.slice(-3)].join("***");
};
//# sourceMappingURL=api-key-module-service.js.map