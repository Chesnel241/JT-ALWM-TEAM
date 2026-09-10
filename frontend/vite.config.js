import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

// Plugin personnalisé pour forcer la mise à jour des clients
const GenerateVersionJson = () => {
  return {
    name: 'generate-version-json',
    buildStart() {
      const versionInfo = {
        version: Date.now().toString(),
        timestamp: new Date().toISOString()
      };
      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(publicDir, 'version.json'),
        JSON.stringify(versionInfo, null, 2)
      );
    }
  };
};

export default defineConfig({
  plugins: [
    GenerateVersionJson(),
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
        globIgnores: ['**/transformers*', '**/ort*', '**/onnx*', '**/remotion*', '**/*whisper*', '**/habillage-logo.png'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      includeAssets: ['favicon.ico', 'logo-lwm.png'],
      manifest: {
        id: '/',
        name: 'JT ALWM Team',
        short_name: 'ALWM',
        description: 'Collecte hebdomadaire des reportages ALWM : envoi des rushes par pays et téléchargement du JT.',
        lang: 'fr',
        dir: 'ltr',
        // Bleu profond du logo, au lieu du bleu ardoise générique : c'est la
        // couleur de la barre système et de l'écran de lancement, donc la
        // première chose que voit un correspondant qui ouvre l'application.
        theme_color: '#0d4d8b',
        background_color: '#0d4d8b',
        display: 'standalone',
        // `/` renvoie l'espace utilisé en dernier sur cet appareil (cf.
        // lib/lastWorkspace.js). Un manifeste ne peut pas s'adapter à la
        // personne ; c'est l'application qui s'en charge à l'ouverture.
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            // Android recadre l'icône (cercle, goutte, carré arrondi). Sans
            // variante masquable, le logo était rogné sur les bords et posé
            // sur une pastille blanche ajoutée par le système.
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    // Les compositions Remotion vivent dans /remotion, hors de la racine du
    // frontend et sans node_modules à elles : leurs imports doivent être
    // résolus explicitement contre les dépendances de l'application. React et
    // react-dom ont rejoint la liste parce que le nouveau moteur de bundling
    // (rolldown, depuis Vite 8) ne remonte plus l'arborescence pour eux.
    alias: {
      'remotion': path.resolve(__dirname, 'node_modules/remotion'),
      '@remotion/transitions': path.resolve(__dirname, 'node_modules/@remotion/transitions'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
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
