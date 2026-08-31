import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // El Worker sirve estos archivos como assets estaticos.
    outDir: '../api/public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // En desarrollo la SPA corre en Vite y la API en wrangler dev.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
