import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Mirrors the `@/*` path alias from tsconfig.json so tests import the same way
// the app does. Vitest does not read tsconfig paths on its own.
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
