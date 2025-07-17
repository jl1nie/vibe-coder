import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Vibe Coder',
        short_name: 'VibeCoder',
        description:
          'スマホから Claude Code を直感的に操作できるモバイル最適化リモート開発環境',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  define: {
    global: 'globalThis',
    process: JSON.stringify({
      env: {
        VIBE_CODER_SIGNALING_URL: env.VIBE_CODER_SIGNALING_URL,
        VIBE_CODER_PWA_URL: env.VIBE_CODER_PWA_URL,
        VIBE_CODER_HOST_URL: env.VIBE_CODER_HOST_URL,
        VIBE_CODER_HOST_DISCOVERY_URL: env.VIBE_CODER_HOST_DISCOVERY_URL,
        NODE_ENV: env.NODE_ENV,
      },
      browser: true,
      version: '',
      platform: 'browser',
      argv: [],
    }),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@vibe-coder/shared': path.resolve(
        __dirname,
        '../../packages/shared/src'
      ),
    },
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          terminal: [
            '@xterm/xterm',
            '@xterm/addon-fit',
            '@xterm/addon-web-links',
          ],
          ui: ['lucide-react', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  server: {
    port: 5174,
    host: true,
    strictPort: true,
  },
  preview: {
    port: 5174,
    host: true,
    strictPort: true,
  },
  };
});
