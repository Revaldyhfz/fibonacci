import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const DJANGO = process.env.VITE_DJANGO_URL || 'http://127.0.0.1:8010';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api':       { target: DJANGO, changeOrigin: true },
      '/portfolio': { target: DJANGO, changeOrigin: true },
      '/analytics': { target: DJANGO, changeOrigin: true },
    },
  },
});
