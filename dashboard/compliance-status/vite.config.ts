import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 5179,
    strictPort: false,
  },
  preview: {
    port: 4179,
  },
  build: {
    outDir: '../../dist/compliance-status',
    emptyOutDir: true,
  },
});
