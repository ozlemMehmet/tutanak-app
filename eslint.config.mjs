// ESLint 9 flat config (kok). Workspace'ler bu yapilandirmayi genisletir — CLAUDE.md §1, §9.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'apps/web/dev-dist/**',
      'apps/web/src/api/schema.d.ts',
      'factory/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Web tarafi: React hook kurallari + erisilebilirlik (CLAUDE.md §9).
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // Nest dekoratorleri sinif metodlarini "this" kullanmadan tanimlar.
      '@typescript-eslint/class-methods-use-this': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'tools/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
  {
    // Nest modul siniflari dekoratorden ibarettir; govdesiz olmalari beklenen kaliptir.
    files: ['apps/api/**/*.module.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    // Yapilandirma dosyalari (.mjs) TypeScript projesine dahil degildir; tip-farkindali
    // kurallar bu dosyalar icin kapatilir.
    files: ['**/*.mjs', '**/*.cjs', '**/*.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: false, project: false },
    },
  },
);
