import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "dist",
      ".astro",
      "node_modules",
      "archive",
      ".worktrees",
      "zip images backup",
    ],
  },
  ...astro.configs["flat/recommended"],
  {
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  {
    ...js.configs.recommended,
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
  {
    ...js.configs.recommended,
    files: ["**/*.ts"],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      parser: tsParser,
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
];
