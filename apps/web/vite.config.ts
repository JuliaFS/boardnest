import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: '../..',
  plugins: [tailwindcss(), react()],
  test: {
    environment: 'jsdom',
    env: {
      VITE_API_URL: 'http://localhost:4000',
      VITE_GRAPHQL_URL: 'http://localhost:4000/graphql',
    },
  },
});
