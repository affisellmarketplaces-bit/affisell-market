import {
  buildPermission,
  usePermissions,
  useRegisterPermissions
} from "./chunk-HFX2KPQD.mjs";

// src/components/common/permission-guard/permission-guard.tsx
import { Fragment, jsx } from "react/jsx-runtime";
var PermissionGuard = ({
  children,
  fallback = null,
  showLoading = false,
  loadingComponent = null,
  ...props
}) => {
  let requiredPermissions = null;
  let requireAll = false;
  if ("permission" in props && props.permission) {
    requiredPermissions = [props.permission];
  } else if ("permissions" in props && props.permissions) {
    requiredPermissions = props.permissions;
    requireAll = !!props.requireAll;
  } else if ("resource" in props && "operation" in props) {
    requiredPermissions = [buildPermission(props.resource, props.operation)];
  }
  useRegisterPermissions(requiredPermissions, { requireAll });
  const { hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();
  if (isLoading && showLoading) {
    return /* @__PURE__ */ jsx(Fragment, { children: loadingComponent });
  }
  const hasAccess = props.requireAll ? hasAllPermissions(requiredPermissions ?? []) : hasAnyPermission(requiredPermissions ?? []);
  if (!hasAccess) {
    return /* @__PURE__ */ jsx(Fragment, { children: fallback });
  }
  return /* @__PURE__ */ jsx(Fragment, { children });
};

export {
  PermissionGuard
};
