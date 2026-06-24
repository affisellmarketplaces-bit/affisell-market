// src/providers/permissions-provider/permissions-requirements-provider.tsx
import { useCallback, useMemo, useState } from "react";

// src/providers/permissions-provider/permissions-requirements-context.tsx
import { createContext } from "react";
var PermissionsRequirementsContext = createContext(null);

// src/providers/permissions-provider/permissions-requirements-provider.tsx
import { jsx } from "react/jsx-runtime";
var PermissionsRequirementsProvider = ({
  children
}) => {
  const [requirements, setRequirements] = useState({});
  const registerRequiredPermissions = useCallback(
    (id, requirement) => {
      setRequirements((prevState) => ({
        ...prevState,
        [id]: requirement
      }));
    },
    []
  );
  const unregisterRequiredPermissions = useCallback((id) => {
    setRequirements((prevState) => {
      const newState = { ...prevState };
      delete newState[id];
      return newState;
    });
  }, []);
  const requiredPermissions = useMemo(() => {
    const deduped = [];
    const seen = /* @__PURE__ */ new Set();
    for (const requirement of Object.values(requirements)) {
      if (!requirement.permissions.length) {
        continue;
      }
      const key = [
        requirement.requireAll ? "all" : "any",
        [...requirement.permissions].sort().join("|"),
        requirement.source || ""
      ].join("::");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(requirement);
    }
    return deduped;
  }, [requirements]);
  const value = useMemo(
    () => ({
      requiredPermissions,
      registerRequiredPermissions,
      unregisterRequiredPermissions
    }),
    [
      requiredPermissions,
      registerRequiredPermissions,
      unregisterRequiredPermissions
    ]
  );
  return /* @__PURE__ */ jsx(PermissionsRequirementsContext.Provider, { value, children });
};

// src/providers/permissions-provider/use-permissions.tsx
import { useContext } from "react";

// src/providers/permissions-provider/permissions-context.tsx
import { createContext as createContext2 } from "react";
var PermissionsContext = createContext2(null);

// src/providers/permissions-provider/use-permissions.tsx
var usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error(
      "usePermissions must be used within a PermissionsProvider"
    );
  }
  return context;
};

// src/providers/permissions-provider/permissions-provider.tsx
import { useCallback as useCallback2, useMemo as useMemo2 } from "react";

// src/lib/permissions/constants.ts
var OPERATION_IMPLICATIONS = {
  read: ["read"],
  create: ["create"],
  update: ["update"],
  delete: ["delete"],
  "*": ["read", "create", "update", "delete", "*"]
};

// src/lib/permissions/utils.ts
function parsePermission(permission) {
  const parts = permission.split(":");
  if (parts.length !== 2) {
    return null;
  }
  const [resource, operation] = parts;
  return {
    resource,
    operation
  };
}
function buildPermission(resource, operation) {
  return `${resource}:${operation}`;
}

// src/providers/permissions-provider/permissions-provider.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
var PermissionsProvider = ({
  policy,
  isLoading = false,
  isRbacEnabled = true,
  children
}) => {
  const permissionsMap = useMemo2(() => {
    const index = /* @__PURE__ */ Object.create(null);
    for (const granted of policy?.permissions ?? []) {
      const parsed = parsePermission(granted);
      if (!parsed) {
        continue;
      }
      const { resource, operation } = parsed;
      const impliedOperations = OPERATION_IMPLICATIONS[operation] || [operation];
      for (const impliedOperation of impliedOperations) {
        index[buildPermission(resource, impliedOperation)] = true;
      }
    }
    return index;
  }, [policy]);
  const hasPermission = useCallback2(
    (permission) => {
      if (!isRbacEnabled) {
        return true;
      }
      return !!permissionsMap[permission];
    },
    [isRbacEnabled, permissionsMap]
  );
  const hasAnyPermission = useCallback2(
    (permissions) => {
      if (!isRbacEnabled) {
        return true;
      }
      if (!permissions?.length) {
        return false;
      }
      return permissions.some(hasPermission);
    },
    [isRbacEnabled, hasPermission]
  );
  const hasAllPermissions = useCallback2(
    (permissions) => {
      if (!isRbacEnabled) {
        return true;
      }
      if (!permissions?.length) {
        return false;
      }
      return permissions.every(hasPermission);
    },
    [isRbacEnabled, hasPermission]
  );
  const can = useCallback2(
    (resource, operation) => {
      if (!isRbacEnabled) {
        return true;
      }
      return !!permissionsMap[buildPermission(resource, operation)];
    },
    [isRbacEnabled, permissionsMap]
  );
  const value = useMemo2(
    () => ({
      policy,
      isLoading,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      can
    }),
    [policy, isLoading, hasPermission, hasAnyPermission, hasAllPermissions, can]
  );
  return /* @__PURE__ */ jsx2(PermissionsContext.Provider, { value, children });
};

// src/providers/permissions-provider/use-register-permissions.tsx
import { useContext as useContext2, useEffect, useId } from "react";
var normalizePermissions = (permissions) => {
  return Array.from(new Set(permissions)).sort();
};
var useRegisterPermissions = (permissions, options = {}) => {
  const context = useContext2(PermissionsRequirementsContext);
  const registerRequiredPermissions = context?.registerRequiredPermissions ?? (() => {
  });
  const unregisterRequiredPermissions = context?.unregisterRequiredPermissions ?? (() => {
  });
  const id = useId();
  const enabled = options.enabled ?? true;
  const requireAll = options.requireAll ?? false;
  const permissionsKey = permissions?.length ? normalizePermissions(permissions).join("|") : "";
  const key = `${permissionsKey}::${requireAll}::${options.source || ""}`;
  useEffect(() => {
    if (!enabled || !permissionsKey) {
      return;
    }
    registerRequiredPermissions(id, {
      permissions: permissionsKey.split("|"),
      requireAll,
      source: options.source
    });
    return () => {
      unregisterRequiredPermissions(id);
    };
  }, [
    enabled,
    id,
    key,
    permissionsKey,
    registerRequiredPermissions,
    requireAll,
    unregisterRequiredPermissions,
    options.source
  ]);
};

// src/providers/permissions-provider/permissions-requirement.tsx
import { Fragment, jsx as jsx3 } from "react/jsx-runtime";

// src/providers/permissions-provider/use-required-permissions.tsx
import { useContext as useContext3 } from "react";
var useRequiredPermissions = () => {
  const context = useContext3(PermissionsRequirementsContext);
  return context?.requiredPermissions ?? [];
};

export {
  buildPermission,
  PermissionsProvider,
  useRegisterPermissions,
  PermissionsRequirementsProvider,
  usePermissions,
  useRequiredPermissions
};
