
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Family Food Night',
          short_name: 'FoodNight',
          description: 'Family Dining Decision App',
          theme_color: '#ffffff',
          background_color: '#f8fafc',
          display: 'standalone', 
          orientation: 'portrait-primary',
          start_url: '/',
          icons: [
            {
              src: '/favicon.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: '/favicon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
           runtimeCaching: [
             {
               urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
               handler: 'CacheFirst',
               options: {
                 cacheName: 'google-fonts-cache',
                 expiration: {
                   maxEntries: 10,
                   maxAgeSeconds: 60 * 60 * 24 * 365
                 },
                 cacheableResponse: {
                   statuses: [0, 200]
                 }
               }
             }
           ]
        }
      })
    ],
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});
