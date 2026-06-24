import {
  ExtensionContext
} from "./chunk-5SZFF255.mjs";

// src/providers/extension-provider/extension-provider.tsx
import { jsx } from "react/jsx-runtime";
var ExtensionProvider = ({
  api,
  children
}) => {
  return /* @__PURE__ */ jsx(ExtensionContext.Provider, { value: api, children });
};

export {
  ExtensionProvider
};
