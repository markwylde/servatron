import js from "@eslint/js";
import typescriptParser from "@typescript-eslint/parser";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // Base JS rules
  js.configs.recommended,

  // Global ignores
  globalIgnores([
    "node_modules/**",
    "dist/**",
    "build/**",
    "docs/**",
    // Ignore JS/TS files in the ROOT directory only
    // Use ./ prefix to explicitly target files in the directory containing this config

  ]),

  {
    languageOptions: {
      ecmaVersion: 12,
      parser: typescriptParser,
      globals: {
        // Common Node.js globals
        process: "readonly",
        console: "readonly",
        module: "readonly",
        URL: "readonly",
        // Add any other globals you need here
      }
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
    },
    rules: {
      // Turn off ESLint core rule
      "no-unused-vars": "off",
      // Use the TypeScript version of the rule
      "@typescript-eslint/no-unused-vars": "error"
    }
  },
]);
