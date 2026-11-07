import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.next/**',
      'node_modules/**',
      'eslint.config.js',
      'vitest.config.ts',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
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
            // Engine Layer Purity: Zero dependencies on other layers
            {
              target: './src/engine/**',
              from: './src/game/**',
              message: 'Engine must not import from game layer',
            },
            {
              target: './src/engine/**',
              from: './src/shared/**',
              message: 'Engine must not import from shared layer',
            },
            {
              target: './src/engine/**',
              from: './src/server/**',
              message: 'Engine must not import from server layer',
            },
            {
              target: './src/engine/**',
              from: './src/client/**',
              message: 'Engine must not import from client layer',
            },
            {
              target: './src/engine/**',
              from: './src/rendering/**',
              message: 'Engine must not import from rendering layer',
            },
            {
              target: './src/engine/**',
              from: './src/dev-tool/**',
              message: 'Engine must not import from dev-tool layer',
            },
            {
              target: './src/engine/**',
              from: './src/app/**',
              message: 'Engine must not import from app layer',
            },
            {
              target: './src/engine/**',
              from: './src/components/**',
              message: 'Engine must not import from components layer',
            },

            // Shared Layer Purity: Only engine and shared allowed
            {
              target: './src/shared/**',
              from: './src/game/**',
              message: 'Shared must not import from game layer',
            },
            {
              target: './src/shared/**',
              from: './src/server/**',
              message: 'Shared must not import from server layer',
            },
            {
              target: './src/shared/**',
              from: './src/client/**',
              message: 'Shared must not import from client layer',
            },
            {
              target: './src/shared/**',
              from: './src/rendering/**',
              message: 'Shared must not import from rendering layer',
            },
            {
              target: './src/shared/**',
              from: './src/dev-tool/**',
              message: 'Shared must not import from dev-tool layer',
            },
            {
              target: './src/shared/**',
              from: './src/app/**',
              message: 'Shared must not import from app layer',
            },
            {
              target: './src/shared/**',
              from: './src/components/**',
              message: 'Shared must not import from components layer',
            },

            // Client Layer Restrictions: No server, no dev-tool
            {
              target: './src/client/**',
              from: './src/server/**',
              message: 'Client must not import from server layer',
            },
            {
              target: './src/client/**',
              from: './src/dev-tool/**',
              message: 'Client must not import from dev-tool layer',
            },

            // Rendering Layer Restrictions: No server, no client, no dev-tool
            {
              target: './src/rendering/**',
              from: './src/server/**',
              message: 'Rendering must not import from server layer',
            },
            {
              target: './src/rendering/**',
              from: './src/dev-tool/**',
              message: 'Rendering must not import from dev-tool layer',
            },

            // Server Layer Restrictions: No rendering, no client, no dev-tool
            {
              target: './src/server/**',
              from: './src/rendering/**',
              message: 'Server must not import from rendering layer',
            },
            {
              target: './src/server/**',
              from: './src/client/**',
              message: 'Server must not import from client layer',
            },
            {
              target: './src/server/**',
              from: './src/dev-tool/**',
              message: 'Server must not import from dev-tool layer',
            },
          ],
        },
      ],
    },
  },
);
