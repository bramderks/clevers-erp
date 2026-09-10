import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Existing data-loading effects intentionally update local state after
      // asynchronous work. This rule is too strict for that established pattern.
      "react-hooks/set-state-in-effect": "off",

      // JSX text can legitimately contain quotation marks and apostrophes.
      "react/no-unescaped-entities": "off",

      // The web-push ambient module is intentionally untyped by its upstream
      // package declaration and is isolated in types/web-push-module.d.ts.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

// CI enforces a zero-warning ESLint result.
export default eslintConfig;
