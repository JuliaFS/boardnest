import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: '../..',
  plugins: [tailwindcss(), react()],
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 45,
        functions: 40,
        lines: 55,
        statements: 55,
      },
    },
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    env: {
      VITE_API_URL: 'http://localhost:4000',
      VITE_GRAPHQL_URL: 'http://localhost:4000/graphql',
      VITE_WS_URL: 'ws://localhost:4000/graphql',
    },
  },
});
