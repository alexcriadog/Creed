import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// Los tests de integración de lib/mcp corren contra Supabase local (pnpm db:start).
loadEnv({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['lib/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      include: ['lib/mcp/**'],
      exclude: ['lib/mcp/**/*.test.ts', 'lib/mcp/test-utils.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      // Next resuelve los paquetes del workspace por tsconfig paths; vitest necesita el alias explícito.
      '@creed/whoop': path.resolve(__dirname, '../../packages/integrations/whoop/src/index.ts'),
    },
  },
});
