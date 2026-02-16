import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/testSetup.ts'],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://ujamaa_user:ujamaa_pass@postgres_test:5432/ujamaa_test_db',
     
    },
    include: ['tests/**/*.test.{ts,js}', 'src/**/*.test.{ts,js}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      'cypress',
      '**/*.{config,setup}.js',
    ],
  },
});