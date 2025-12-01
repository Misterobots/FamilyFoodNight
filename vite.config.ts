
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // Load env from file (.env) or system (Docker ENV)
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Prioritize Docker Env Var (VITE_API_KEY) then .env file
  // Fallback to API_KEY for convenience
  const apiKey = process.env.VITE_API_KEY || env.VITE_API_KEY || process.env.API_KEY || env.API_KEY || '';
  
  console.log(`[Vite Build] Injection Key present: ${!!apiKey}`);

  return {
    define: {
      // Create a global constant that contains the API key string.
      // This is safer than relying on import.meta.env in Docker environments.
      __API_KEY__: JSON.stringify(apiKey),
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'FamEats',
          short_name: 'FamEats',
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
