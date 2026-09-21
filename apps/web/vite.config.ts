import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: '../..',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    env: {
      VITE_API_URL: 'http://localhost:4000',
    },
  },
});
