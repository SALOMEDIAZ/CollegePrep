// reglas base recomendadas de eslint
import js from '@eslint/js'
// variables globales del navegador (window, document)
import globals from 'globals'
// importamos modulos que necesitamos aqui
// plugin que revisa reglas de hooks de react
import reactHooks from 'eslint-plugin-react-hooks'
// avisa si hmr de vite se rompe por exportar componentes mal
import reactRefresh from 'eslint-plugin-react-refresh'
// importamos modulos que necesitamos aqui
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// reglas de lint para typescript y react
export default defineConfig([
  // no lintear la carpeta dist del build
  globalIgnores(['dist']),
  // parte del flujo que explica el paso a paso
  {
    files: ['**/*.{ts,tsx}'],
    // parte del flujo que explica el paso a paso
    extends: [
      js.configs.recommended,
      // parte del flujo que explica el paso a paso
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      // parte del flujo que explica el paso a paso
      reactRefresh.configs.vite,
    ],
    // parte del flujo que explica el paso a paso
    languageOptions: {
      ecmaVersion: 2020,
      // parte del flujo que explica el paso a paso
      globals: globals.browser,
    },
  // parte del flujo que explica el paso a paso
  },
])
