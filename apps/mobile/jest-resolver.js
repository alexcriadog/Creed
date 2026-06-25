/**
 * Custom Jest resolver that:
 * 1. Delegates to react-native-worklets resolver for worklets resolution.
 * 2. Deduplicates 'react' — forces all imports to use the app's root React,
 *    preventing "invalid hook call" when a workspace package has its own
 *    react in node_modules (pnpm monorepo hoisting edge case).
 */
const path = require('path');
const workletsResolver = require('react-native-worklets/jest/resolver.js');

const APP_ROOT = path.resolve(__dirname);

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) => {
  // Deduplicate react — redirect any react import to the app's own copy.
  // This handles the case where packages/ui-native/node_modules/react exists
  // and causes "invalid hook call" due to two React instances.
  if (request === 'react' || request.startsWith('react/')) {
    try {
      return require.resolve(request, { paths: [APP_ROOT] });
    } catch {
      // Fall through to default resolver if not found
    }
  }

  return workletsResolver(request, options);
};
