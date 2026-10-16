import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // `public/` là tài sản tĩnh phục vụ nguyên trạng — `config.js` ở đó còn là
  // tệp dev-local (skip-worktree), lint nó vô nghĩa và đang đẻ ra 42 lỗi.
  { ignores: ["dist", ".output", ".vinxi", "public", "coverage"] },
  eslintPluginPrettier,
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // Định dạng để mức CẢNH BÁO: repo còn ~900 chỗ lệch prettier, để mức lỗi
      // thì `npm run lint` đỏ ngay và không ai đọc nổi lỗi thật. Dọn định dạng
      // hàng loạt là việc riêng (diff lớn, dễ đụng nhánh đang mở).
      "prettier/prettier": "warn",
    },
  },
);
