import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  // .claude/worktrees holds other agents' isolated git worktree checkouts,
  // nested under this repo root - without this, `eslint .` walks into
  // whatever branch is checked out there too and lint failures in a
  // completely unrelated in-flight change block this one's own `npm run
  // check` (confirmed live: a concurrent worktree's scripts/*.cjs tripped
  // no-require-imports here).
  { ignores: ['**/node_modules', '**/dist', '**/out', '.claude/worktrees'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  eslintConfigPrettier,
  {
    // Plain Node dev scripts, not part of the TS app — placed last so it
    // overrides the TS-oriented rules above for these files specifically.
    files: ['scripts/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  }
)
