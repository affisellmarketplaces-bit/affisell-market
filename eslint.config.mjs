import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Data fetching / hydration in useEffect legitimately calls setState; the rule flags most loaders.
      "react-hooks/set-state-in-effect": "off",
      // React Compiler — warn on legacy memo/ref patterns until refactored file-by-file.
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
      // Legal bodies + API export/download links need plain <a>, not client <Link>.
      "@next/next/no-html-link-for-pages": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /** Medusa sub-app — own lint/tsconfig; generated .medusa/types must not block Affisell CI */
    "medusa-backend/**",
  ]),
]);

export default eslintConfig;
