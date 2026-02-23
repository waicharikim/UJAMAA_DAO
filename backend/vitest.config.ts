import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@modules': resolve(__dirname, 'src/modules'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./tests/testSetup.ts'],
    environment: 'node',
    // Run test files sequentially to avoid concurrent DB mutations between files
    // (both auth test files use the same UUID constants + shared postgres_test DB).
    fileParallelism: false,
    // These are set BEFORE any module is loaded — the correct place for env vars.
    // testSetup.ts process.env assignments run after ESM imports are hoisted,
    // so they never reach env.ts validation. Keep all required vars here.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://ujamaa_user:ujamaa_pass@postgres_test:5432/ujamaa_test_db',
      JWT_SECRET: '6e603cfa9affb7677020ad6a930bd3f076867ff38d100586dc5d985bed845ad0',
      BASE_URL: 'http://localhost:4000',
      FRONTEND_URL: 'http://localhost:3000',
      ENABLE_EMAILS: 'false',
      LOG_LEVEL: 'error',
      PORT: '4000',
    },
    include: ['tests/**/*.test.{ts,js}', 'src/**/*.test.{ts,js}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      'cypress',
      '**/*.{config,setup}.js',
      // Old tests written against a pre-refactor schema — excluded until rewritten
      'tests/old/**',
    ],
  },
});
