import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'eslint.config.js', 'vitest.config.ts', '**/*.test.ts', '**/*.test.tsx'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      'import-x': importX,
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/engine/**',
              from: './src/game/**',
              message: 'Engine must not import from game layer',
            },
            {
              target: './src/engine/**',
              from: './src/rendering/**',
              message: 'Engine must not import from rendering layer',
            },
            {
              target: './src/engine/**',
              from: './src/network/**',
              message: 'Engine must not import from network layer',
            },
            {
              target: './src/engine/**',
              from: './src/ui/**',
              message: 'Engine must not import from UI layer',
            },
          ],
        },
      ],
    },
  },
);
