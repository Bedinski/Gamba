import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, isPreview }) => ({
  // Served from https://bedinski.github.io/Gamba/ on GitHub Pages; dev server stays at /.
  base: command === 'build' || isPreview ? '/Gamba/' : '/',
  plugins: [react()],
  test: { globals: true, environment: 'node' },
}));
