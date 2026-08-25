import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'release/**',
      'build/**',
      'coverage/**',
      'native/**/build/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'scripts/**/*.mjs',
      'src/main/**/*.ts',
      'src/preload/**/*.ts',
      'tests/e2e/**/*.ts',
      '*.ts',
      '*.mjs'
    ],
    languageOptions: { globals: globals.node }
  },
  {
    // Pacote nativo local: CommonJS puro, carregado pelo worker do Electron.
    files: ['native/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['src/renderer/src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat['recommended-latest']
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ],
      'no-console': 'off'
    }
  },
  prettier
)
