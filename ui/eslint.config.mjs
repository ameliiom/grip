import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { uiSystemPlugin } from "./eslint-ui-primitives.mjs";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "scripts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "ui-system": uiSystemPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "ui-system/no-raw-controls": "error",
      "ui-system/no-adhoc-hex-or-inner-scroll": "error",
      "ui-system/no-duplicate-entity-views": "error",
      "ui-system/no-external-sdk-outside-acl": "error",
      "ui-system/no-physical-css-directions": "error",
      "ui-system/no-child-outer-margin": "error",
    },
  },
);
