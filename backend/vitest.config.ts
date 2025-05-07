import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.mts', 'tests/**/*.mts'],
    globals: true,            // This injects globals like describe, it, beforeAll automatically
    setupFiles: ['./tests/setup.mts'],  // Optional: configure dotenv or setup
  },
});