import js from "@eslint/js";
import react from "@eslint-react/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import playwright from "eslint-plugin-playwright";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/reports/**",
    "**/test-results/**",
    "**/playwright-report/**",
    "ci-artifacts/**",
    "server/data/**",
    ".git/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Playwright fixtures require object destructuring, even with no dependencies.
      "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
    },
  },
  {
    files: [
      "server/**/*.ts",
      "automation/**/*.ts",
      ".github/**/*.ts",
      "client/vite.config.ts",
      "eslint.config.ts",
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["client/src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      "client/**/*.{ts,tsx}",
      "server/**/*.ts",
      "automation/**/*.ts",
      ".github/scripts/**/*.ts",
    ],
    languageOptions: {
      parserOptions: {
        project: [
          "./client/tsconfig.json",
          "./server/tsconfig.json",
          "./automation/tsconfig.json",
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          // The Node test runner owns and reports test registration promises.
          allowForKnownSafeCalls: [
            { from: "package", package: "node:test", name: "test" },
          ],
        },
      ],
      "@typescript-eslint/await-thenable": "error",
      // React event attributes intentionally accept async event handlers.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    files: ["client/src/**/*.tsx"],
    extends: [react.configs.jsx],
    // Register only the plugin surface we use; its bundled configs have nested legacy types.
    plugins: {
      "react-hooks": { meta: reactHooks.meta, rules: reactHooks.rules },
    },
    rules: {
      "@eslint-react/no-missing-key": "error",
      "@eslint-react/no-duplicate-key": "error",
      "@eslint-react/no-array-index-key": "error",
      "@eslint-react/no-nested-component-definitions": "error",
      "@eslint-react/dom-no-dangerously-set-innerhtml-with-children": "error",
      "@eslint-react/dom-no-unsafe-target-blank": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["automation/tests/**/*.spec.ts"],
    extends: [playwright.configs["flat/recommended"]],
  },
  // Keep formatting with Prettier while ESLint checks code correctness.
  prettier,
]);
