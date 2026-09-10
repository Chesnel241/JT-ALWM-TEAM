import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Mêmes alias que vite.config.js : les compositions Remotion vivent hors de
  // la racine du frontend et sans node_modules à elles. Sans ça, le test de
  // DashboardView échouait depuis longtemps sur « Failed to resolve import
  // "remotion" », alors que le build de production, lui, passait.
  resolve: {
    alias: {
      'remotion': path.resolve(__dirname, 'node_modules/remotion'),
      '@remotion/transitions': path.resolve(__dirname, 'node_modules/@remotion/transitions'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    css: false,
  },
});
