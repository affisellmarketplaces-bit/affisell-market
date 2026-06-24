"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _RedisCachingProvider_instances, _RedisCachingProvider_getKeyName, _RedisCachingProvider_getTagKey, _RedisCachingProvider_getTagsKey, _RedisCachingProvider_getTagDictionaryKey, _RedisCachingProvider_getTagNextIdKey, _RedisCachingProvider_getTagRefCountKey, _RedisCachingProvider_getTagReverseDictionaryKey, _RedisCachingProvider_internTags, _RedisCachingProvider_resolveTagIds, _RedisCachingProvider_decrementTagRefs, _RedisCachingProvider_compressData, _RedisCachingProvider_decompressData;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCachingProvider = void 0;
const zlib_1 = require("zlib");
class RedisCachingProvider {
    constructor({ redisClient, logger, prefix, hasher, }, options) {
        _RedisCachingProvider_instances.add(this);
        this.redisClient = redisClient;
        this.keyNamePrefix = prefix;
        this.defaultTTL = options?.ttl ?? 3600; // 1 hour default
        this.compressionThreshold = options?.compressionThreshold ?? 2048; // 2KB default
        this.hasher = hasher;
        this.logger = logger;
    }
    isConnectionError(error) {
        return (error.code === "ECONNREFUSED" ||
            error.code === "ENOTFOUND" ||
            error.code === "ETIMEDOUT" ||
            error.code === "ECONNRESET" ||
            error.code === "EPIPE" ||
            error.message?.includes("Connection is closed") ||
            error.message?.includes("connect ECONNREFUSED") ||
            error.message?.includes("connect ETIMEDOUT") ||
            error.message?.includes("Command timed out") ||
            error.message?.includes("Maximum number of retries exceeded") ||
            ["connecting", "reconnecting", "disconnecting", "wait", "end"].includes(this.redisClient.status));
    }
    isConnectionHealthy() {
        return this.redisClient.status === "ready";
    }
    async get({ key, tags }) {
        if (!this.isConnectionHealthy()) {
            return null;
        }
        if (key) {
            try {
                const keyName = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getKeyName).call(this, key);
                const buffer = await this.redisClient.hgetBuffer(keyName, "data");
                if (!buffer) {
                    return null;
                }
                const finalData = await __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_decompressData).call(this, buffer);
                return JSON.parse(finalData);
            }
            catch (error) {
                if (this.isConnectionError(error)) {
                    this.logger.warn("Redis connection error during get operation, returning null to trigger fallback to original data source");
                    return null;
                }
                throw error;
            }
        }
        if (tags?.length) {
            try {
                // Get all keys associated with the tags
                const pipeline = this.redisClient.pipeline();
                tags.forEach((tag) => {
                    const tagKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagKey).call(this, tag);
                    pipeline.smembers(tagKey);
                });
                const tagResults = await pipeline.exec();
                const allKeys = new Set();
                tagResults?.forEach((result, index) => {
                    if (result && result[1]) {
                        ;
                        result[1].forEach((key) => allKeys.add(key));
                    }
                });
                if (allKeys.size === 0) {
                    return [];
                }
                // Get all hash data for the keys
                const valuePipeline = this.redisClient.pipeline();
                Array.from(allKeys).forEach((key) => {
                    valuePipeline.hgetBuffer(key, "data");
                });
                const valueResults = await valuePipeline.exec();
                const results = [];
                const decompressionPromises = (valueResults || []).map(async (result) => {
                    if (result && result[1]) {
                        const buffer = result[1];
                        try {
                            const finalData = await __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_decompressData).call(this, buffer);
                            return JSON.parse(finalData);
                        }
                        catch (e) {
                            // If JSON parsing fails, skip this entry (corrupted data)
                            this.logger.warn(`Skipping corrupted cache entry: ${e.message}`);
                            return null;
                        }
                    }
                    return null;
                });
                const decompressionResults = await Promise.all(decompressionPromises);
                results.push(...decompressionResults.filter(Boolean));
                return results;
            }
            catch (error) {
                if (this.isConnectionError(error)) {
                    this.logger.warn("Redis connection error during get operation, returning empty array to trigger fallback to original data source");
                    return null;
                }
                throw error;
            }
        }
        return null;
    }
    async set({ key, data, ttl, tags, options, }) {
        try {
            const keyName = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getKeyName).call(this, key);
            const serializedData = JSON.stringify(data);
            const effectiveTTL = ttl ?? this.defaultTTL;
            const finalData = await __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_compressData).call(this, serializedData);
            let tagIds = [];
            if (tags?.length) {
                tagIds = await __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_internTags).call(this, tags);
            }
            const setPipeline = this.redisClient.pipeline();
            // Main data with conditional operations
            setPipeline.hsetnx(keyName, "data", finalData);
            if (options && Object.keys(options).length) {
                setPipeline.hset(keyName, "options", JSON.stringify(options));
            }
            if (effectiveTTL) {
                setPipeline.expire(keyName, effectiveTTL);
            }
            // Store tag IDs if present
            if (tags?.length && tagIds.length) {
                const tagsKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagsKey).call(this, key);
                const buffer = Buffer.alloc(tagIds.length * 4);
                tagIds.forEach((id, index) => {
                    buffer.writeUInt32LE(id, index * 4);
                });
                if (effectiveTTL) {
                    setPipeline.set(tagsKey, buffer, "EX", effectiveTTL + 60, "NX");
                }
                else {
                    setPipeline.setnx(tagsKey, buffer);
                }
                // Add tag operations to the same pipeline
                tags.forEach((tag) => {
                    const tagKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagKey).call(this, tag);
                    setPipeline.sadd(tagKey, keyName);
                    if (effectiveTTL) {
                        setPipeline.expire(tagKey, effectiveTTL + 60);
                    }
                });
            }
            await setPipeline.exec();
        }
        catch (error) {
            if (this.isConnectionError(error)) {
                this.logger.warn("Redis connection error during set operation, relying on IORedis retry mechanism");
                return;
            }
            throw error;
        }
    }
    async clear({ key, tags, options, }) {
        try {
            if (key) {
                const keyName = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getKeyName).call(this, key);
                const tagsKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagsKey).call(this, key);
                const clearPipeline = this.redisClient.pipeline();
                // Get tags for cleanup and delete main key in same pipeline
                clearPipeline.getBuffer(tagsKey);
                clearPipeline.unlink(keyName);
                const results = await clearPipeline.exec();
                const tagsBuffer = results?.[0]?.[1];
                if (tagsBuffer?.length) {
                    try {
                        // Binary format: array of 32-bit integers
                        const tagIds = [];
                        for (let i = 0; i < tagsBuffer.length; i += 4) {
                            tagIds.push(tagsBuffer.readUInt32LE(i));
                        }
                        if (tagIds.length) {
                            const entryTags = await __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_resolveTagIds).call(this, tagIds);
                            const tagCleanupPipeline = this.redisClient.pipeline();
                            entryTags.forEach((tag) => {
                                const tagKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagKey).call(this, tag, { isHashed: true });
                                tagCleanupPipeline.srem(tagKey, keyName);
                            });
                            tagCleanupPipeline.unlink(tagsKey);
                            await tagCleanupPipeline.exec();
                            // Decrement reference counts and cleanup unused tags
                            await __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_decrementTagRefs).call(this, tagIds);
                        }
                    }
                    catch (e) {
                        // noop - corrupted tag data, skip cleanup
                    }
                }
                return;
            }
            if (tags?.length) {
                // Handle wildcard tag to clear all cache data
                if (tags.includes("*")) {
                    await this.flush();
                    return;
                }
                // Get all keys associated with the tags
                const pipeline = this.redisClient.pipeline();
                tags.forEach((tag) => {
                    const tagKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagKey).call(this, tag);
                    pipeline.smembers(tagKey);
                });
                const tagResults = await pipeline.exec();
                const allKeys = new Set();
                tagResults?.forEach((result) => {
                    if (result && result[1]) {
                        ;
                        result[1].forEach((key) => allKeys.add(key));
                    }
                });
                if (allKeys.size) {
                    // If no options provided (user explicit call), clear everything
                    if (!options) {
                        const deletePipeline = this.redisClient.pipeline();
                        // Delete main keys and options
                        Array.from(allKeys).forEach((key) => {
                            deletePipeline.unlink(key);
                        });
                        // Clean up tag references for each key
                        const tagDataPromises = Array.from(allKeys).map(async (key) => {
                            const keyWithoutPrefix = key.replace(this.keyNamePrefix, "");
                            const tagsKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagsKey).call(this, keyWithoutPrefix);
                            const tagsData = await this.redisClient.getBuffer(tagsKey);
                            return { key, tagsKey, tagsData };
                        });
                        const tagResults = await Promise.all(tagDataPromises);
                        // Build single pipeline for all tag cleanup operations
                        const tagCleanupPipeline = this.redisClient.pipeline();
                        const cleanupPromises = tagResults.map(async ({ key, tagsKey, tagsData }) => {
                            if (tagsData) {
                                try {
                                    // Binary format: array of 32-bit integers
                                    const tagIds = [];
                                    for (let i = 0; i < tagsData.length; i += 4) {
                                        tagIds.push(tagsData.readUInt32LE(i));
                                    }
                                    if (tagIds.length) {
                                        const entryTags = await __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_resolveTagIds).call(this, tagIds);
                                        entryTags.forEach((tag) => {
                                            const tagKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagKey).call(this, tag, { isHashed: true });
                                            tagCleanupPipeline.srem(tagKey, key);
                                        });
                                        tagCleanupPipeline.unlink(tagsKey);
                                        // Decrement reference counts and cleanup unused tags
                                        await __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_decrementTagRefs).call(this, tagIds);
                                    }
                                }
                                catch (e) {
                                    // noop
                                }
                            }
                        });
                        await Promise.all(cleanupPromises);
                        await tagCleanupPipeline.exec();
                        await deletePipeline.exec();
                        return;
                    }
                    // If autoInvalidate is true (strategy call), only clear entries with autoInvalidate=true (default)
                    if (options.autoInvalidate === true) {
                        const optionsPipeline = this.redisClient.pipeline();
                        Array.from(allKeys).forEach((key) => {
                            optionsPipeline.hget(key, "options");
                        });
                        const optionsResults = await optionsPipeline.exec();
                        const keysToDelete = [];
                        Array.from(allKeys).forEach((key, index) => {
                            const optionsResult = optionsResults?.[index];
                            if (optionsResult && optionsResult[1]) {
                                try {
                                    const entryOptions = JSON.parse(optionsResult[1]);
                                    // Delete if entry has autoInvalidate=true or no setting (default true)
                                    const shouldAutoInvalidate = entryOptions.autoInvalidate ?? true;
                                    if (shouldAutoInvalidate) {
                                        keysToDelete.push(key);
                                    }
                                }
                                catch (e) {
                                    // If can't parse options, assume it's safe to delete (default true)
                                    keysToDelete.push(key);
                                }
                            }
                            else {
                                // No options stored, default to true
                                keysToDelete.push(key);
                            }
                        });
                        if (keysToDelete.length) {
                            const deletePipeline = this.redisClient.pipeline();
                            keysToDelete.forEach((key) => {
                                deletePipeline.unlink(key);
                            });
                            // Clean up tag references for each key to delete
                            const tagDataPromises = keysToDelete.map(async (key) => {
                                const keyWithoutPrefix = key.replace(this.keyNamePrefix, "");
                                const tagsKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagsKey).call(this, keyWithoutPrefix);
                                const tagsData = await this.redisClient.getBuffer(tagsKey);
                                return { key, tagsKey, tagsData };
                            });
                            // Wait for all tag data fetches
                            const tagResults = await Promise.all(tagDataPromises);
                            // Build single pipeline for all tag cleanup operations
                            const tagCleanupPipeline = this.redisClient.pipeline();
                            const cleanupPromises = tagResults.map(async ({ key, tagsKey, tagsData }) => {
                                if (tagsData) {
                                    try {
                                        // Binary format: array of 32-bit integers
                                        const tagIds = [];
                                        for (let i = 0; i < tagsData.length; i += 4) {
                                            tagIds.push(tagsData.readUInt32LE(i));
                                        }
                                        if (tagIds.length) {
                                            const entryTags = await __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_resolveTagIds).call(this, tagIds);
                                            entryTags.forEach((tag) => {
                                                const tagKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagKey).call(this, tag, {
                                                    isHashed: true,
                                                });
                                                tagCleanupPipeline.srem(tagKey, key);
                                            });
                                            tagCleanupPipeline.unlink(tagsKey); // Delete the tags key
                                            // Decrement reference counts and cleanup unused tags
                                            await __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_decrementTagRefs).call(this, tagIds);
                                        }
                                    }
                                    catch (e) {
                                        // noop
                                    }
                                }
                            });
                            await Promise.all(cleanupPromises);
                            await tagCleanupPipeline.exec();
                            await deletePipeline.exec();
                            return;
                        }
                    }
                }
            }
        }
        catch (error) {
            if (this.isConnectionError(error)) {
                this.logger.warn("Redis connection error during clear operation, relying on IORedis retry mechanism");
                return;
            }
            throw error;
        }
    }
    async flush() {
        try {
            // Use SCAN to find ALL keys with our prefix and delete them
            // This includes main cache keys, tag keys (tag:*), and tags keys (tags:*)
            const pattern = `${this.keyNamePrefix}*`;
            let cursor = "0";
            do {
                const result = await this.redisClient.scan(cursor, "MATCH", pattern, "COUNT", 1000);
                cursor = result[0];
                const keys = result[1];
                if (keys.length) {
                    await this.redisClient.unlink(...keys);
                }
            } while (cursor !== "0");
        }
        catch (error) {
            if (this.isConnectionError(error)) {
                this.logger.warn("Redis connection error during flush operation, relying on IORedis retry mechanism");
                return;
            }
            throw error;
        }
    }
}
exports.RedisCachingProvider = RedisCachingProvider;
_RedisCachingProvider_instances = new WeakSet(), _RedisCachingProvider_getKeyName = function _RedisCachingProvider_getKeyName(key) {
    return `${this.keyNamePrefix}${key}`;
}, _RedisCachingProvider_getTagKey = function _RedisCachingProvider_getTagKey(tag, { isHashed = false } = {}) {
    return `${this.keyNamePrefix}tag:${isHashed ? tag : this.hasher(tag)}`;
}, _RedisCachingProvider_getTagsKey = function _RedisCachingProvider_getTagsKey(key) {
    return `${this.keyNamePrefix}tags:${key}`;
}, _RedisCachingProvider_getTagDictionaryKey = function _RedisCachingProvider_getTagDictionaryKey() {
    return `${this.keyNamePrefix}tag:dictionary`;
}, _RedisCachingProvider_getTagNextIdKey = function _RedisCachingProvider_getTagNextIdKey() {
    return `${this.keyNamePrefix}tag:next_id`;
}, _RedisCachingProvider_getTagRefCountKey = function _RedisCachingProvider_getTagRefCountKey() {
    return `${this.keyNamePrefix}tag:refs`;
}, _RedisCachingProvider_getTagReverseDictionaryKey = function _RedisCachingProvider_getTagReverseDictionaryKey() {
    return `${this.keyNamePrefix}tag:reverse_dict`;
}, _RedisCachingProvider_internTags = async function _RedisCachingProvider_internTags(tags) {
    const pipeline = this.redisClient.pipeline();
    const dictionaryKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagDictionaryKey).call(this);
    const hashedTags = tags.map((tag) => this.hasher(tag));
    // Get existing tag IDs
    hashedTags.forEach((tag) => {
        pipeline.hget(dictionaryKey, tag);
    });
    const results = await pipeline.exec();
    const tagIds = [];
    const newTags = [];
    for (let i = 0; i < hashedTags.length; i++) {
        const result = results?.[i];
        if (result && result[1]) {
            tagIds[i] = parseInt(result[1]);
        }
        else {
            const hashedTag = hashedTags[i];
            newTags.push(hashedTag);
            tagIds[i] = -1; // Placeholder for new tags
        }
    }
    // Create IDs for new tags
    if (newTags.length) {
        const nextIdKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagNextIdKey).call(this);
        const reverseDictKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagReverseDictionaryKey).call(this);
        const refCountKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagRefCountKey).call(this);
        const startId = await this.redisClient.incrby(nextIdKey, newTags.length);
        const batchPipeline = this.redisClient.pipeline();
        newTags.forEach((tag, index) => {
            const newId = startId - newTags.length + index + 1;
            // Store in both forward and reverse dictionaries
            batchPipeline.hset(dictionaryKey, tag, newId.toString());
            batchPipeline.hset(reverseDictKey, newId.toString(), tag);
            // Update the tagIds array
            const originalIndex = hashedTags.indexOf(tag);
            tagIds[originalIndex] = newId;
        });
        // Add reference count increments to the same pipeline
        tagIds.forEach((id) => {
            if (id !== -1) {
                batchPipeline.hincrby(refCountKey, id.toString(), 1);
            }
        });
        await batchPipeline.exec();
    }
    else {
        // Only increment reference count for existing tags
        const refCountKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagRefCountKey).call(this);
        const refPipeline = this.redisClient.pipeline();
        tagIds.forEach((id) => {
            refPipeline.hincrby(refCountKey, id.toString(), 1);
        });
        await refPipeline.exec();
    }
    return tagIds;
}, _RedisCachingProvider_resolveTagIds = async function _RedisCachingProvider_resolveTagIds(tagIds) {
    if (tagIds.length === 0)
        return [];
    const reverseDictKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagReverseDictionaryKey).call(this);
    const pipeline = this.redisClient.pipeline();
    tagIds.forEach((id) => {
        pipeline.hget(reverseDictKey, id.toString());
    });
    const results = await pipeline.exec();
    return results?.map((result) => result?.[1]).filter(Boolean) || [];
}, _RedisCachingProvider_decrementTagRefs = async function _RedisCachingProvider_decrementTagRefs(tagIds) {
    if (tagIds.length === 0)
        return;
    const refCountKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagRefCountKey).call(this);
    const dictionaryKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagDictionaryKey).call(this);
    // Decrement reference counts and collect tags with zero refs
    const pipeline = this.redisClient.pipeline();
    tagIds.forEach((id) => {
        pipeline.hincrby(refCountKey, id.toString(), -1);
    });
    const results = await pipeline.exec();
    const tagsToCleanup = [];
    // Find tags that now have zero references
    results?.forEach((result, index) => {
        if (result && result[1] === 0) {
            tagsToCleanup.push(tagIds[index]);
        }
    });
    // Clean up tags with zero references
    if (tagsToCleanup.length) {
        const cleanupPipeline = this.redisClient.pipeline();
        const reverseDictKey = __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_getTagReverseDictionaryKey).call(this);
        // Get tag names before deleting them
        const tagNames = await __classPrivateFieldGet(this, _RedisCachingProvider_instances, "m", _RedisCachingProvider_resolveTagIds).call(this, tagsToCleanup);
        tagsToCleanup.forEach((id, index) => {
            const idStr = id.toString();
            // Remove from reference count hash
            cleanupPipeline.hdel(refCountKey, idStr);
            // Remove from reverse dictionary
            cleanupPipeline.hdel(reverseDictKey, idStr);
            // Remove from forward dictionary
            if (tagNames[index]) {
                cleanupPipeline.hdel(dictionaryKey, tagNames[index]);
            }
        });
        await cleanupPipeline.exec();
    }
}, _RedisCachingProvider_compressData = async function _RedisCachingProvider_compressData(data) {
    if (data.length <= this.compressionThreshold) {
        const buffer = Buffer.from(data, "utf8");
        const prefix = Buffer.from([0]); // 0 = uncompressed
        return Buffer.concat([prefix, buffer]);
    }
    return new Promise((resolve, reject) => {
        const chunks = [];
        const gzip = (0, zlib_1.createGzip)();
        gzip.on("data", (chunk) => chunks.push(chunk));
        gzip.on("end", () => {
            const compressedBuffer = Buffer.concat(chunks);
            const prefix = Buffer.from([1]); // 1 = compressed
            resolve(Buffer.concat([prefix, compressedBuffer]));
        });
        gzip.on("error", (error) => {
            const buffer = Buffer.from(data, "utf8");
            const prefix = Buffer.from([0]);
            resolve(Buffer.concat([prefix, buffer]));
        });
        gzip.write(data, "utf8");
        gzip.end();
    });
}, _RedisCachingProvider_decompressData = async function _RedisCachingProvider_decompressData(buffer) {
    if (buffer.length === 0) {
        return "";
    }
    const formatByte = buffer[0];
    const dataBuffer = buffer.subarray(1);
    if (formatByte === 0) {
        // Uncompressed
        return dataBuffer.toString("utf8");
    }
    if (formatByte === 1) {
        // Compressed with gzip
        return new Promise((resolve, reject) => {
            const chunks = [];
            const gunzip = (0, zlib_1.createGunzip)();
            gunzip.on("data", (chunk) => chunks.push(chunk));
            gunzip.on("end", () => {
                const decompressed = Buffer.concat(chunks).toString("utf8");
                resolve(decompressed);
            });
            gunzip.on("error", (error) => {
                // Fallback: return as-is if decompression fails
                resolve(dataBuffer.toString("utf8"));
            });
            gunzip.write(dataBuffer);
            gunzip.end();
        });
    }
    // Unknown format, return as UTF-8
    return buffer.toString("utf8");
};
RedisCachingProvider.identifier = "cache-redis";
//# sourceMappingURL=redis-cache.js.map