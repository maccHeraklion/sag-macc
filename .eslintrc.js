module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 6,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    "jest/globals": true,
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import", "jest", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    eqeqeq: [2, "smart"],
    "no-console": 1,
    "no-alert": 2,
    "no-unused-vars": 0,
    "@typescript-eslint/no-explicit-any": 1,
    "@typescript-eslint/no-unused-vars": [1, { argsIgnorePattern: "^_", ignoreRestSiblings: true }],
    "import/order": 2,
    "import/newline-after-import": 2,
    "import/no-unresolved": 0,

    // New JSX transforms
    "react/jsx-uses-react": 0,
    "react/react-in-jsx-scope": 0,
  },
};
