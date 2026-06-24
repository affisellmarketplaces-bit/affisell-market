"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const index_1 = __importDefault(require("../reporter/index"));
const glob_1 = require("glob");
const CODEMOD = {
    name: "replace-zod-imports",
    description: "Replace all zod imports with @medusajs/framework/zod imports",
    run: replaceZodImports,
};
exports.default = CODEMOD;
// Replacement patterns for zod imports
// Order matters: more specific patterns must come before general ones
const REPLACEMENTS = [
    // Default import with identifier "zod": import zod from "zod" -> import { z as zod } from "@medusajs/framework/zod"
    {
        pattern: /import\s+zod\s+from\s+['"]zod['"]/g,
        replacement: `import { z as zod } from "@medusajs/framework/zod"`,
    },
    // Default import with identifier "z": import z from "zod" -> import { z } from "@medusajs/framework/zod"
    {
        pattern: /import\s+z\s+from\s+['"]zod['"]/g,
        replacement: `import { z } from "@medusajs/framework/zod"`,
    },
    // Namespace import with other identifier: import * as something from "zod" -> import { z as something } from "@medusajs/framework/zod"
    {
        pattern: /import\s+\*\s+as\s+(\w+)\s+from\s+['"]zod['"]/g,
        replacement: `import { z as $1 } from "@medusajs/framework/zod"`,
    },
    // Named/type imports: import { z } from "zod" or import type { ZodSchema } from "zod"
    {
        pattern: /from\s+['"]zod['"]/g,
        replacement: `from "@medusajs/framework/zod"`,
    },
    // CommonJS require: require("zod")
    {
        pattern: /require\s*\(\s*['"]zod['"]\s*\)/g,
        replacement: `require("@medusajs/framework/zod")`,
    },
];
const ZOD_IMPORT_PATTERN = /from\s+['"]zod['"]|require\s*\(\s*['"]zod['"]\s*\)/;
/**
 * Replace all zod imports with @medusajs/framework/zod imports
 */
async function replaceZodImports(options) {
    const { dryRun = false } = options;
    const targetFiles = await getTargetFiles();
    const numberOfFiles = Object.keys(targetFiles).length;
    if (numberOfFiles === 0) {
        index_1.default.info("  No files found with zod imports");
        return { filesScanned: 0, filesModified: 0, errors: 0 };
    }
    index_1.default.info(`  Found ${numberOfFiles} files to process`);
    let filesModified = 0;
    let errors = 0;
    for (const [filePath, content] of Object.entries(targetFiles)) {
        try {
            if (processFile(filePath, content, dryRun)) {
                filesModified++;
            }
        }
        catch (error) {
            index_1.default.error(`✗ Error processing ${filePath}: ${error.message}`);
            errors++;
        }
    }
    return { filesScanned: numberOfFiles, filesModified, errors };
}
/**
 * Process a single file and replace zod imports
 * @returns true if the file was modified, false otherwise
 */
function processFile(filePath, content, dryRun) {
    let modifiedContent = content;
    for (const { pattern, replacement } of REPLACEMENTS) {
        modifiedContent = modifiedContent.replace(pattern, replacement);
    }
    if (modifiedContent === content) {
        return false;
    }
    if (dryRun) {
        index_1.default.info(`  Would update: ${filePath}`);
    }
    else {
        fs_1.default.writeFileSync(filePath, modifiedContent);
        index_1.default.info(`✓ Updated: ${filePath}`);
    }
    return true;
}
/**
 * Find all TypeScript/JavaScript files that contain zod imports
 * @returns Array of file paths with zod imports
 */
async function getTargetFiles() {
    try {
        // Find TypeScript/JavaScript files, excluding build artifacts, dependencies, and src/admin
        const files = await (0, glob_1.glob)("**/*.{ts,js,tsx,jsx}", {
            ignore: [
                "**/node_modules/**",
                "**/.git/**",
                "**/dist/**",
                "**/build/**",
                "**/coverage/**",
                "**/.medusa/**",
                "**/src/admin/**",
            ],
            nodir: true,
        });
        index_1.default.info(` Scanning ${files.length} files for zod imports...`);
        const targetFiles = {};
        let processedCount = 0;
        for (const file of files) {
            try {
                const content = fs_1.default.readFileSync(file, "utf8");
                if (ZOD_IMPORT_PATTERN.test(content)) {
                    targetFiles[file] = content;
                }
                processedCount++;
                if (processedCount % 100 === 0) {
                    process.stdout.write(`\r Processed ${processedCount}/${files.length} files...`);
                }
            }
            catch {
                // Skip files that can't be read
                continue;
            }
        }
        if (processedCount > 0) {
            process.stdout.write(`\r Processed ${processedCount} files.                    \n`);
        }
        return targetFiles;
    }
    catch (error) {
        index_1.default.error(`Error finding target files: ${error.message}`);
        return {};
    }
}
//# sourceMappingURL=replace-zod-imports.js.map