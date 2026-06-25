module.exports = {
  preset: 'jest-expo',
  setupFiles: [
    'react-native-worklets/lib/module/mock.js',
    'react-native-reanimated/mock',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  roots: ['<rootDir>', '<rootDir>/../../packages/ui-native'],
  resolver: require.resolve('./jest-resolver.js'),
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|react-native-worklets|lucide-react-native))',
  ],
};
