import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: false,
  },
  preview: {
    port: 4175,
  },
  build: {
    outDir: '../../dist/governance-feed',
    emptyOutDir: true,
  },
});
