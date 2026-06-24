#!/usr/bin/env node
/**
 * Migration Script: Assign Super Admin Role to All Admin Users
 *
 * This script assigns the pre-created super admin role
 * to all existing admin users in your Medusa instance.
 *
 * Usage: npx tsx packages/medusa/src/migration-scripts/create-super-admin-role.ts
 */
import { ExecArgs } from "@medusajs/framework/types";
export default function createSuperAdminRole({ container }: ExecArgs): Promise<void>;
//# sourceMappingURL=create-super-admin-role.d.ts.map