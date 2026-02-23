import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/reddit': {
        target: 'https://www.reddit.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/reddit/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Reddit requires a real-ish User-Agent to return JSON instead of HTML
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (compatible; AdGenerator/1.0)');
          });
        },
      },
      '/api/meta': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/landing-page': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
