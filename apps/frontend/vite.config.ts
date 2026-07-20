import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Dev'de /api istekleri backend'e (3001) proxy'lenir -> CORS yok.
// Prod'da backend, build edilmis frontend'i ayni origin'den servis eder.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA: app-shell precache -> tablet offline'da uygulama acilir. OFFLINE_DESIGN.md §3, K5
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { navigateFallbackDenylist: [/^\/api/] }, // /api asla shell'e dusmesin
      manifest: {
        name: 'Adisyon POS',
        short_name: 'Adisyon',
        lang: 'tr',
        display: 'standalone',
        start_url: '/',
        theme_color: '#1e293b',
        background_color: '#f1f5f9',
        icons: [], // ponytail: ikon seti sonra, kurulabilirlik icin eklenir
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true, // LAN'dan (garson cihazlari) erisilebilir
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
});
