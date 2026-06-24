// src/providers/extension-provider/use-extension.tsx
import { useContext } from "react";

// src/providers/extension-provider/extension-context.tsx
import { createContext } from "react";
var ExtensionContext = createContext(null);

// src/providers/extension-provider/use-extension.tsx
var useExtension = () => {
  const context = useContext(ExtensionContext);
  if (!context) {
    throw new Error("useExtension must be used within a ExtensionProvider");
  }
  return context;
};

export {
  ExtensionContext,
  useExtension
};
