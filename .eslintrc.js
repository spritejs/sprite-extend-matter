module.exports = {
  globals: {
    spritejs: 'spritejs',
    spriteMatter: 'spriteMatter',
  },
  extends:  "eslint-config-sprite",
  plugins: ["html"],
  rules: {
    "complexity": ["warn", 25],
    'import/prefer-default-export': 'off',
    'no-continue': 'off',
    'default-case': 'off',
  },
}
