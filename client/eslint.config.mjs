import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  eslintConfigPrettier,
  globalIgnores(["dist/**", "build/**", "src/routeTree.gen.ts"]),
]);

export default eslintConfig;
