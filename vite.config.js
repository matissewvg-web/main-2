import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths so the built interface also loads from disk inside Electron.
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  server: { port: 5173, proxy: { '/api': 'http://localhost:4750' } },
});
