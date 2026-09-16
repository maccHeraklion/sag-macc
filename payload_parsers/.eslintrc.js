module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    "no-undef": "error",
    quotes: ["error", "double"],
  },
};
