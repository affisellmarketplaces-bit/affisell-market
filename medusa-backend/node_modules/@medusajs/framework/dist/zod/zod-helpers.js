"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zodValidator = zodValidator;
const zod_1 = require("@medusajs/deps/zod");
const utils_1 = require("@medusajs/utils");
/**
 * Runtime guard for invalid_type issues.
 * Uses duck-typing to avoid relying on internal Zod types at runtime.
 */
function isInvalidTypeIssue(issue) {
    return ((0, utils_1.isObject)(issue) &&
        "code" in issue &&
        issue.code === "invalid_type" &&
        "expected" in issue &&
        "path" in issue &&
        Array.isArray(issue.path));
}
/**
 * Runtime guard for invalid_union issues.
 * Uses duck-typing to avoid relying on internal Zod types at runtime.
 */
function isInvalidUnionIssue(issue) {
    return ((0, utils_1.isObject)(issue) &&
        "code" in issue &&
        issue.code === "invalid_union" &&
        "errors" in issue &&
        Array.isArray(issue.errors));
}
/**
 * Runtime guard for invalid_value issues (enums, literals).
 * Uses duck-typing to avoid relying on internal Zod types at runtime.
 */
function isInvalidValueIssue(issue) {
    return ((0, utils_1.isObject)(issue) &&
        "code" in issue &&
        issue.code === "invalid_value" &&
        "path" in issue &&
        Array.isArray(issue.path));
}
function getReceivedValue(issue, body) {
    if ("input" in issue) {
        return issue.input;
    }
    else if ("received" in issue) {
        return issue.received;
    }
    else {
        return getValueFromBody(issue, body);
    }
}
const formatPath = (issue) => {
    return issue.path.join(", ");
};
/**
 * Gets the actual value from body using issue path.
 * Used to distinguish between missing fields and wrong type values.
 * Safely traverses the body object using the issue path.
 */
function getValueFromBody(issue, body) {
    if (!(0, utils_1.isObject)(body)) {
        return undefined;
    }
    return issue.path.reduce((acc, curr) => {
        if (!(0, utils_1.isObject)(acc)) {
            return undefined;
        }
        return acc[curr];
    }, body);
}
const formatInvalidType = (issues, body) => {
    const validIssues = [];
    for (const issue of issues) {
        if (isInvalidTypeIssue(issue)) {
            validIssues.push(issue);
        }
    }
    const expected = validIssues
        .map((i) => {
        // In Zod v4, check if value exists in body to distinguish wrong type vs missing
        const receivedValue = body !== undefined ? getValueFromBody(i, body) : undefined;
        if (receivedValue !== undefined) {
            return i.expected;
        }
        return;
    })
        .filter(Boolean);
    if (!expected.length) {
        return;
    }
    const firstIssue = validIssues[0];
    if (!firstIssue) {
        return;
    }
    const received = body !== undefined ? getValueFromBody(firstIssue, body) : "unknown";
    return `Expected type: '${expected.join(", ")}' for field '${formatPath(firstIssue)}', got: '${received}'`;
};
const formatRequiredField = (issues, body) => {
    // Find the first issue that indicates a required field (value is undefined in body)
    const requiredIssue = issues
        .filter((i) => i != null)
        .find((i) => {
        if (isInvalidTypeIssue(i)) {
            // In Zod v4, check if value is undefined in body to detect missing fields
            const valueInBody = body !== undefined ? getValueFromBody(i, body) : undefined;
            return valueInBody === undefined;
        }
        // Also check invalid_value issues - if value is undefined in body
        if (isInvalidValueIssue(i)) {
            const valueInBody = body !== undefined ? getValueFromBody(i, body) : undefined;
            return valueInBody === undefined;
        }
        return false;
    });
    if (!requiredIssue) {
        return;
    }
    return `Field '${formatPath(requiredIssue)}' is required`;
};
const formatUnionError = (issue, body) => {
    // Use runtime guard to validate the issue structure
    if (!isInvalidUnionIssue(issue)) {
        return (0, utils_1.isObject)(issue) && "message" in issue
            ? String(issue.message)
            : undefined;
    }
    const parentPath = issue.path ?? [];
    const issues = issue.errors
        .flatMap((e) => {
        // In Zod v4, errors is an array of arrays (each inner array contains issues for a union variant)
        if (Array.isArray(e)) {
            return e;
        }
        // Fallback for object with issues property (for compatibility)
        if ((0, utils_1.isObject)(e) && "issues" in e) {
            return e.issues;
        }
        return [];
    })
        .filter((i) => (0, utils_1.isObject)(i) && "path" in i)
        .map((i) => ({
        ...i,
        path: [...parentPath, ...i.path],
    }));
    if (!issues.length) {
        return issue.message;
    }
    return (formatInvalidType(issues, body) ||
        formatRequiredField(issues, body) ||
        issue.message);
};
const formatError = (err, body) => {
    const issueMessages = err.issues.slice(0, 3).map((issue) => {
        switch (issue.code) {
            case "invalid_type":
                return (formatInvalidType([issue], body) ||
                    formatRequiredField([issue], body) ||
                    issue.message);
            case "invalid_value": {
                const invalidValueIssue = issue;
                const receivedValue = getReceivedValue(issue, body);
                const hasReceivedValue = receivedValue !== undefined;
                if (invalidValueIssue.values) {
                    if (!hasReceivedValue) {
                        return `Field '${formatPath(issue)}' is required`;
                    }
                    return `Expected: '${invalidValueIssue.values.join(", ")}' for field '${formatPath(issue)}', but got: '${receivedValue}'`;
                }
                if (!hasReceivedValue) {
                    return `Field '${formatPath(issue)}' is required`;
                }
                return issue.message;
            }
            case "invalid_union":
                return formatUnionError(issue, body);
            case "unrecognized_keys":
                return `Unrecognized fields: '${issue.keys.join(", ")}'`;
            case "too_small":
                return `Value for field '${formatPath(issue)}' too small, expected at least: '${issue.minimum}'`;
            case "too_big":
                return `Value for field '${formatPath(issue)}' too big, expected at most: '${issue.maximum}'`;
            case "not_multiple_of":
                return `Value for field '${formatPath(issue)}' not multiple of: '${issue.divisor}'`;
            case "invalid_format":
            case "invalid_key":
            case "invalid_element":
            case "custom":
            default:
                return issue.message;
        }
    });
    return issueMessages.join("; ");
};
function isZodError(err) {
    return (err instanceof zod_1.ZodError ||
        ((0, utils_1.isObject)(err) && "issues" in err && Array.isArray(err.issues)));
}
async function zodValidator(zodSchema, body) {
    let strictSchema = zodSchema;
    if ("strict" in zodSchema) {
        strictSchema = zodSchema.strict();
    }
    try {
        return await strictSchema.parseAsync(body);
    }
    catch (err) {
        if (isZodError(err)) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `Invalid request: ${formatError(err, body)}`);
        }
        throw err;
    }
}
//# sourceMappingURL=zod-helpers.js.map