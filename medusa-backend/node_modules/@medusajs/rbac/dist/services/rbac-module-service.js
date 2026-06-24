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
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const _models_1 = require("../models");
const SUPER_ADMIN_KEY = `${utils_1.WILDCARD}:${utils_1.WILDCARD}`;
class RbacModuleService extends (0, utils_1.MedusaService)({
    RbacRole: _models_1.RbacRole,
    RbacPolicy: _models_1.RbacPolicy,
    RbacRoleParent: _models_1.RbacRoleParent,
    RbacRolePolicy: _models_1.RbacRolePolicy,
}) {
    constructor({ rbacRepository, rbacRoleService, rbacPolicyService, rbacRolePolicyService, }) {
        // @ts-ignore
        super(...arguments);
        this.__hooks = {
            onApplicationStart: async () => {
                this.onApplicationStart();
            },
        };
        this.rbacRepository_ = rbacRepository;
        this.rbacRolePolicyService = rbacRolePolicyService;
        this.rbacRoleService = rbacRoleService;
        this.rbacPolicyService = rbacPolicyService;
    }
    async onApplicationStart() {
        await this.syncRegisteredPolicies();
    }
    async syncRegisteredPolicies(sharedContext = {}) {
        const registeredPolicies = Object.entries(utils_1.Policy).map(([name, { resource, operation, description }]) => ({
            key: `${resource}:${operation}`,
            name,
            resource,
            operation,
            description,
        }));
        const registeredKeys = registeredPolicies.map((p) => p.key);
        // Fetch all existing policies (including soft-deleted ones)
        const existingPolicies = await this.listRbacPolicies({}, { withDeleted: true }, sharedContext);
        const existingPoliciesMap = new Map(existingPolicies.map((p) => [p.key, p]));
        const policiesToCreate = [];
        const policiesToUpdate = [];
        const policiesToRestore = [];
        // Process registered policies
        for (const registeredPolicy of registeredPolicies) {
            if (registeredPolicy.key === SUPER_ADMIN_KEY) {
                continue;
            }
            const existing = existingPoliciesMap.get(registeredPolicy.key);
            const hasChanges = existing &&
                (existing.name !== registeredPolicy.name ||
                    existing.description !== registeredPolicy.description);
            if (!existing) {
                policiesToCreate.push(registeredPolicy);
            }
            else if (existing.deleted_at) {
                policiesToRestore.push(existing.id);
                if (hasChanges) {
                    policiesToUpdate.push({
                        id: existing.id,
                        name: registeredPolicy.name,
                        description: registeredPolicy.description,
                    });
                }
            }
            else if (hasChanges) {
                policiesToUpdate.push({
                    id: existing.id,
                    name: registeredPolicy.name,
                    description: registeredPolicy.description,
                });
            }
        }
        const policiesToSoftDelete = existingPolicies
            .filter((p) => !p.deleted_at &&
            !registeredKeys.includes(p.key) &&
            p.key !== SUPER_ADMIN_KEY)
            .map((p) => p.id);
        // First restore any soft-deleted policies
        if (policiesToRestore.length > 0) {
            await this.restoreRbacPolicies(policiesToRestore, {}, sharedContext);
        }
        await (0, utils_1.promiseAll)([
            policiesToCreate.length > 0 &&
                this.rbacPolicyService.create(policiesToCreate, sharedContext),
            policiesToUpdate.length > 0 &&
                this.rbacPolicyService.upsert(policiesToUpdate, sharedContext),
            policiesToSoftDelete.length > 0 &&
                this.rbacPolicyService.softDelete(policiesToSoftDelete, sharedContext),
        ]);
    }
    async listPoliciesForRole(roleId, sharedContext = {}) {
        return await this.rbacRepository_.listPoliciesForRole(roleId, sharedContext);
    }
    // @ts-expect-error
    async listRbacRoles(filters = {}, config = {}, sharedContext = {}) {
        const roles = await super.listRbacRoles(filters, config, sharedContext);
        const shouldIncludePolicies = config.relations?.includes("policies") ||
            config.select?.includes("policies");
        if (shouldIncludePolicies && roles.length > 0) {
            const roleIds = roles.map((role) => role.id);
            const policiesByRole = await this.rbacRepository_.listPoliciesForRoles(roleIds, sharedContext);
            for (const role of roles) {
                role.policies = policiesByRole.get(role.id) || [];
            }
        }
        return roles;
    }
    // @ts-expect-error
    async listAndCountRbacRoles(filters = {}, config = {}, sharedContext = {}) {
        const [roles, count] = await super.listAndCountRbacRoles(filters, config, sharedContext);
        const shouldIncludePolicies = config.relations?.includes("policies") ||
            config.select?.includes("policies");
        if (shouldIncludePolicies && roles.length > 0) {
            const roleIds = roles.map((role) => role.id);
            const policiesByRole = await this.rbacRepository_.listPoliciesForRoles(roleIds, sharedContext);
            for (const role of roles) {
                role.policies = policiesByRole.get(role.id) || [];
            }
        }
        return [roles, count];
    }
    // @ts-expect-error
    async createRbacRoleParents(data, sharedContext = {}) {
        for (const parent of data) {
            const { role_id, parent_id } = parent;
            if (role_id === parent_id) {
                throw new Error(`Cannot create role parent relationship: a role cannot be its own parent (role_id: ${role_id})`);
            }
            const wouldCreateCycle = await this.rbacRepository_.checkForCycle(role_id, parent_id, sharedContext);
            if (wouldCreateCycle) {
                throw new Error(`Cannot create role parent relationship: this would create a circular dependency (role_id: ${role_id}, parent_id: ${parent_id})`);
            }
        }
        return await super.createRbacRoleParents(data, sharedContext);
    }
    // @ts-expect-error
    async updateRbacRoleParents(data, sharedContext = {}) {
        for (const parent of data) {
            const { role_id, parent_id } = parent;
            if (parent_id) {
                if (role_id === parent_id) {
                    throw new Error(`Cannot update role parent relationship: a role cannot be its own parent (role_id: ${role_id})`);
                }
                const wouldCreateCycle = await this.rbacRepository_.checkForCycle(role_id, parent_id, sharedContext);
                if (wouldCreateCycle) {
                    throw new Error(`Cannot update role parent relationship: this would create a circular dependency (role_id: ${role_id}, parent_id: ${parent_id})`);
                }
            }
        }
        return await super.updateRbacRoleParents(data, sharedContext);
    }
}
exports.default = RbacModuleService;
__decorate([
    (0, utils_1.InjectTransactionManager)(),
    __param(0, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RbacModuleService.prototype, "syncRegisteredPolicies", null);
__decorate([
    (0, utils_1.InjectManager)(),
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], RbacModuleService.prototype, "listPoliciesForRole", null);
__decorate([
    (0, utils_1.InjectManager)()
    // @ts-expect-error
    ,
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RbacModuleService.prototype, "listRbacRoles", null);
__decorate([
    (0, utils_1.InjectManager)()
    // @ts-expect-error
    ,
    __param(2, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], RbacModuleService.prototype, "listAndCountRbacRoles", null);
__decorate([
    (0, utils_1.InjectManager)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], RbacModuleService.prototype, "createRbacRoleParents", null);
__decorate([
    (0, utils_1.InjectManager)()
    // @ts-expect-error
    ,
    __param(1, (0, utils_1.MedusaContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], RbacModuleService.prototype, "updateRbacRoleParents", null);
//# sourceMappingURL=rbac-module-service.js.map