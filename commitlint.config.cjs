// Conventional Commits zorunlu (CONVENTIONS.md §7). commit-msg hook'u dogrular.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Kapsam serbest; ozne uzunlugu makul tutulur.
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0, 'always', Infinity],
  },
};
