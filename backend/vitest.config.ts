import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8', // or 'istanbul'
      reporter: ['text', 'html'],
    },
    include: ['src/**/*.{test,spec}.{ts,js}'],
  },
});