import js from '@eslint/js';
import ts from '@eslint/js/dist/configs/typescript.js';

export default [
  {
    files: ['**/*.ts', '**/*.js'],
    ...js.config,
  },
  {
    files: ['**/*.ts', '**/*.js'],
    ...ts.config,
    rules: {
      ...ts.config.rules,
      'prettier/prettier': 'error',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
    plugins: {
      ...ts.config.plugins,
      prettier: {},
      'unused-imports': {},
    },
    ignores: ['node_modules'],
  },
];