import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./tests/testSetup.ts'],
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