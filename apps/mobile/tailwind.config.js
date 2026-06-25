/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    '../../packages/ui-native/src/**/*.{ts,tsx}',
  ],
  presets: [
    require('nativewind/preset'),
    require('@creed/ui-native/tailwind-preset'),
  ],
  theme: { extend: {} },
  plugins: [],
};
