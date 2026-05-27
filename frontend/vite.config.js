import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'custom-sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      includeAssets: ['favicon.ico', 'logo-lwm.png'],
      manifest: {
        name: 'JT ALWM Team',
        short_name: 'ALWM',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
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
