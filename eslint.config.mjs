import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import globals from 'globals';

const compat = new FlatCompat({
  baseDirectory: new URL('.', import.meta.url).pathname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  ...compat.extends('@borgar/eslint-config'),
  {
    languageOptions: {
      globals: {
        ...globals.node
      },
      ecmaVersion: 2020,
      sourceType: 'module'
    },
    rules: {
      'no-mixed-operators': 'off'
    }
  }
];
