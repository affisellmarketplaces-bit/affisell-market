import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    rules: {
      // Data fetching / hydration in useEffect legitimately calls setState; the rule flags most loaders.
      "react-hooks/set-state-in-effect": "off",
      // React Compiler — warn on legacy memo/ref patterns until refactored file-by-file.
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      // Legal bodies + API export/download links need plain <a>, not client <Link>.
      "@next/next/no-html-link-for-pages": "warn",
      "unused-imports/no-unused-imports": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ["components/legal/**/*.{ts,tsx}", "app/legal/**/*.tsx", "app/global-error.tsx"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: [
      "components/admin/admin-expansion-console.tsx",
      "components/admin/ae-express-import-launcher.tsx",
      "components/legal/gdpr-account-panel.tsx",
      "components/supplier/agent-network-panel.tsx",
      "components/supplier/supplier-onboarding-csv-wizard.tsx",
      "app/pricing/page.tsx",
      "components/admin/admin-agent-applications.tsx",
      "components/admin/ing-ops-dashboard.tsx",
    ],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
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
    ".vercel/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /** Lighthouse CI config — CommonJS require() by design */
    "lighthouserc.cjs",
    "lighthouse-budgets.cjs",
    /** Medusa sub-app — own lint/tsconfig; generated .medusa/types must not block Affisell CI */
    "medusa-backend/**",
    /** Legacy CLI helper — CommonJS */
    "scripts/get-aliexpress-token.js",
  ]),
]);

export default eslintConfig;
