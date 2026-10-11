import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  // Port fixe : Tauri (src-tauri/tauri.conf.json → devUrl) s'y connecte en développement.
  // `src-tauri/` est exclu du watcher : cargo y écrit des fichiers verrouillés pendant la compilation.
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  clearScreen: false,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'AFE — Facturation et cotisations',
        short_name: 'AFE',
        description:
          "Devis, factures, dépenses, cotisations et impôts pour indépendants et petites sociétés. Fonctionne hors ligne.",
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#f9f9f7',
        theme_color: '#2a78d6',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
});
