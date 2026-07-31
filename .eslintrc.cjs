"use strict";

module.exports = {
  root: true,
  ignorePatterns: [
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "apps/mobile/android/**",
    "apps/mobile/ios/**",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react-hooks"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    es2022: true,
    node: true,
    browser: true,
  },
  rules: {
    "no-constant-condition": ["error", { checkLoops: false }],
    "no-duplicate-case": "error",
    "no-dupe-keys": "error",
    "no-func-assign": "error",
    "no-import-assign": "error",
    "no-self-assign": "error",
    "no-unexpected-multiline": "error",
    "no-unreachable": "error",
    "valid-typeof": "error",

    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],

    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
};
