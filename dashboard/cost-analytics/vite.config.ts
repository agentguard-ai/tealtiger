import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 5176,
    strictPort: false,
  },
  preview: {
    port: 4176,
  },
  build: {
    outDir: '../../dist/cost-analytics',
    emptyOutDir: true,
  },
});
