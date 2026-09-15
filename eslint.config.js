// Lint config. The point of adding this: `no-undef` catches unresolved
// identifiers, which build cleanly and only fail at runtime — a handler that
// calls a name that does not exist throws INSIDE the event listener, taking
// the whole keymap down with no visible symptom.
//
// Separate globals per layer: src/ is browser code, electron/ is node, and the
// preload bridge is CommonJS.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'release/**', 'out/**', 'node_modules/**'] },

  js.configs.recommended,

  // Renderer: browser globals + JSX + hooks rules.
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-undef': 'error',
      // Downgraded deliberately. Every hit is a pattern that is correct here:
      // resetting derived state when the selected skin/account changes
      // ([offer?.id], [selectedLabel]), a 1s clock interval, fetch-on-mount,
      // and syncing the video loading state machine. The rule's advice
      // (derive during render / use keys) would mean restructuring four
      // components for no user-visible gain, so it stays advisory: it is
      // worth re-reading when adding new effects, not worth failing the build.
      'react-hooks/set-state-in-effect': 'warn'
    }
  },

  // Main process: node globals.
  {
    files: ['electron/**/*.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },

  // Preload bridge is CommonJS.
  {
    files: ['electron/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node }
    }
  }
];
