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
      // On gère l'enregistrement manuellement dans main.jsx (via
      // virtual:pwa-register) pour pouvoir détecter une nouvelle version et
      // forcer un reload automatique.
      injectRegister: false,
      injectManifest: {
        // HTML EXCLU du précache : récupéré frais depuis le réseau via la
        // NavigationRoute NetworkFirst (cf. custom-sw.js). Évite que le SW
        // sert un index.html périmé pointant vers des chunks disparus.
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        // Ne pas précacher les gros chunks chargés à la demande (Whisper/ONNX,
        // Remotion) : ils restent récupérés au runtime, le SW reste léger.
        globIgnores: ['**/transformers*', '**/ort*', '**/onnx*', '**/remotion*', '**/*whisper*'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
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
  resolve: {
    alias: {
      'remotion': path.resolve(__dirname, 'node_modules/remotion'),
      '@remotion/transitions': path.resolve(__dirname, 'node_modules/@remotion/transitions'),
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    fs: {
      allow: ['..']
    },
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
