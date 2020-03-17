module.exports = {
  root: true,
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
  ],
  rules: {
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-var-requires": "off",
    "import/extensions": ["error", "always"],
  },
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      rules: {
        "@typescript-eslint/explicit-function-return-type": "error",
        "@typescript-eslint/no-var-requires": "error",
      },
    },
  ],
};
