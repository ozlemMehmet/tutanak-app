import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const DEV_SERVER_PORT = 5173;
// Gelistirme vekili: tarayici `/api/v1`'i ayni kaynakta gorur (CORS yok). Hedef, docker
// compose icinde servis adiyla (http://api:3000) ezilir — bkz. docker-compose.yml.
const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      // Kayit src/pwa/register-service-worker.ts icinde acikca yapilir (test edilebilir olsun diye).
      injectRegister: null,
      filename: 'sw.js',
      // Manifest public/manifest.webmanifest icinde elle yonetilir (CLAUDE.md §1).
      manifest: false,
      workbox: {
        // MVP'de cevrimdisi kayit/senkronizasyon yok; SW yalnizca uygulama kabugunu onbellekler.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
    }),
  ],
  server: {
    host: true,
    port: DEV_SERVER_PORT,
    proxy: {
      '/api': { target: API_PROXY_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
