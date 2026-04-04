import { defineConfig } from "oxlint";

export default defineConfig({
  categories: {
    correctness: "error",
    nursery: "error",
    pedantic: "error",
    perf: "error",
    restriction: "error",
    style: "error",
    suspicious: "error",
  },
  env: { browser: true },
  globals: { chrome: "readonly" },
  ignorePatterns: ["**/fixtures/**"],
  overrides: [
    {
      files: ["build.ts", "scripts/**/*.ts"],
      env: { browser: false, node: true },
      globals: { Bun: "readonly", chrome: "off" },
      rules: {
        "import/no-nodejs-modules": "off",
      },
    },
    {
      files: ["e2e/**/*.ts"],
      env: { browser: true, node: true },
      rules: {
        "import/no-nodejs-modules": "off",
      },
    },
    {
      files: ["**/*.test.ts"],
      globals: { Bun: "readonly" },
      rules: {
        "import/no-nodejs-modules": "off",
      },
    },
    {
      files: ["oxlint.config.ts", "knip.config.ts"],
      env: { browser: false, node: true },
      globals: { chrome: "off" },
      rules: {
        "import/no-default-export": "off",
      },
    },
  ],
  plugins: ["eslint", "typescript", "unicorn", "oxc", "promise", "import"],
  rules: {
    // Prefer function declarations over expressions
    "func-style": ["error", "declaration"],
    // Allow short names for type params, iterators, coordinates, and discard
    "id-length": ["error", { exceptions: ["T", "i", "j", "x", "y", "_"] }],
    // Inline type specifiers preferred over top-level import type
    "import/consistent-type-specifier-style": ["error", "prefer-inline"],
    // Conflicts with consistent-type-specifier-style prefer-inline
    "typescript/no-import-type-side-effects": "off",
    // Exports can appear anywhere in the file
    "import/exports-last": "off",
    // No need to group all exports together
    "import/group-exports": "off",
    // Raise the default dependency limit
    "import/max-dependencies": ["error", { max: 20 }],
    // Named exports are the project standard
    "import/no-named-export": "off",
    "import/prefer-default-export": "off",
    // Variables don't need initializers at declaration
    "init-declarations": "off",
    // Generous function size limits
    "max-lines-per-function": ["error", { max: 250 }],
    "max-statements": ["error", { max: 60 }],
    // Sequential async work is common in DOM automation
    "no-await-in-loop": "off",
    // Console is used for extension logging
    "no-console": "off",
    // Continue improves readability in loops
    "no-continue": "off",
    // Inline comments are fine for eslint-disable directives
    "no-inline-comments": "off",
    // Magic numbers are acceptable in this codebase
    "no-magic-numbers": "off",
    // Ternaries are concise and readable
    "no-ternary": "off",
    // Using undefined is valid
    "no-undefined": "off",
    // Modern JS features are the project standard
    "oxc/no-async-await": "off",
    "oxc/no-optional-chaining": "off",
    "oxc/no-rest-spread-properties": "off",
    // Prefer async/await over .then() but allow in Chrome API callbacks
    "promise/catch-or-return": "off",
    "promise/prefer-await-to-then": "off",
    // Functions may be async for interface conformance without awaiting
    "require-await": "off",
    // Import sorting handled by oxfmt
    "sort-imports": "off",
    // Object key order is not enforced
    "sort-keys": "off",
    // Conflicts with no-unsafe-* rules on textContent (string | null)
    "typescript/no-unnecessary-condition": "off",
    // DOM and Playwright types are inherently mutable — allow them as-is
    "typescript/prefer-readonly-parameter-types": [
      "error",
      {
        allow: [
          { from: "lib", name: "Element" },
          { from: "lib", name: "HTMLElement" },
          { from: "lib", name: "HTMLButtonElement" },
          { from: "lib", name: "HTMLInputElement" },
          { from: "lib", name: "HTMLTextAreaElement" },
          { from: "lib", name: "HTMLImageElement" },
          { from: "lib", name: "HTMLAnchorElement" },
          { from: "lib", name: "HTMLDivElement" },
          { from: "lib", name: "HTMLProgressElement" },
          { from: "lib", name: "HTMLSpanElement" },
          { from: "lib", name: "File" },
          { from: "lib", name: "Blob" },
          { from: "lib", name: "MediaSource" },
          { from: "lib", name: "MessageEvent" },
          { from: "lib", name: "KeyboardEvent" },
          { from: "lib", name: "MouseEvent" },
          { from: "lib", name: "Event" },
          { from: "lib", name: "PointerEvent" },
          { from: "lib", name: "Promise" },
          { from: "lib", name: "RegExp" },
          { from: "lib", name: "Document" },
          { from: "lib", name: "Node" },
          { from: "lib", name: "MutationObserver" },
          { from: "lib", name: "Date" },
          { from: "lib", name: "Uint8Array" },
          { from: "lib", name: "Record" },
          { from: "package", name: "Page", package: "@playwright/test" },
          { from: "package", name: "BrowserContext", package: "@playwright/test" },
          { from: "package", name: "Worker", package: "@playwright/test" },
          { from: "package", name: "Route", package: "@playwright/test" },
          { from: "package", name: "ConsoleMessage", package: "@playwright/test" },
          { from: "package", name: "MessageSender", package: "@types/chrome" },
        ],
        ignoreInferredTypes: true,
        treatMethodsAsReadonly: true,
      },
    ],
    // Not all async functions need the async keyword enforced
    "typescript/promise-function-async": "off",
    // Duplicate of require-await with type awareness — same reasoning
    "typescript/require-await": "off",
    // Chrome onMessage API requires boolean returns in void callbacks
    "typescript/strict-void-return": "off",
  },
});
