import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
    pedantic: "error",
    perf: "error",
    restriction: "error",
    style: "error",
    suspicious: "error",
  },
  ignorePatterns: ["**/fixtures/**"],
  overrides: [
    {
      files: ["build.ts", "e2e/**/*.ts", "scripts/**/*.ts"],
      rules: {
        "import/no-nodejs-modules": "off",
      },
    },
    {
      files: ["oxlint.config.ts"],
      rules: {
        "import/no-default-export": "off",
      },
    },
  ],
  plugins: ["eslint", "typescript", "unicorn", "oxc", "promise", "import"],
  rules: {
    "func-style": ["error", "declaration"],
    "id-length": ["error", { exceptions: ["i", "j", "x", "y", "_"] }],
    "import/consistent-type-specifier-style": "off",
    "import/exports-last": "off",
    "import/group-exports": "off",
    "import/max-dependencies": ["error", { max: 20 }],
    "import/no-named-export": "off",
    "import/prefer-default-export": "off",
    "init-declarations": "off",
    "max-lines-per-function": ["error", { max: 250 }],
    "max-statements": ["error", { max: 60 }],
    "no-await-in-loop": "off",
    "no-console": "off",
    "no-continue": "off",
    "no-inline-comments": "off",
    "no-magic-numbers": "off",
    "no-ternary": "off",
    "no-undefined": "off",
    "oxc/no-async-await": "off",
    "oxc/no-optional-chaining": "off",
    "oxc/no-rest-spread-properties": "off",
    "promise/catch-or-return": "off",
    "promise/prefer-await-to-then": "off",
    "require-await": "off",
    "typescript/promise-function-async": "off",
    "typescript/require-await": "off",
  },
});
