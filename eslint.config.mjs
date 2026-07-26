import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
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
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: [
      "lib/__tests__/**",
      "lib/dev-localhost-url.ts",
      "**/__tests__/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/localhost:300[01]/]",
          message:
            "Ne jamais hardcoder localhost:3000/3001. Utilise getSiteUrl() / getAbsoluteUrl() depuis @/lib/site-url (ou chemin relatif /api/...).",
        },
        {
          selector: "Literal[value=/^https?:\\/\\/localhost/]",
          message:
            "Ne jamais hardcoder http(s)://localhost. Utilise getSiteUrl() depuis @/lib/site-url.",
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
    /** Lighthouse CI config — CommonJS require() by design */
    "lighthouserc.cjs",
    "lighthouse-budgets.cjs",
    /** Medusa sub-app — own lint/tsconfig; generated .medusa/types must not block Affisell CI */
    "medusa-backend/**",
  ]),
]);

export default eslintConfig;
