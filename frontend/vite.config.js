import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3010',
      '/uploads': 'http://localhost:3010',
    },
    watch: {
      usePolling: false,
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        'C:/Users/ekogh/AppData/**',
      ],
    },
  },
});
