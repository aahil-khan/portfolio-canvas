import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent git worktrees live here and ship their own .next output, which otherwise gets
    // linted as if it were source (hundreds of errors from generated bundles).
    ".claude/**",
    // Agent git worktrees live here and carry their own .next build output, which otherwise
    // gets linted as if it were source.
    ".claude/**",
  ]),
]);

export default eslintConfig;
