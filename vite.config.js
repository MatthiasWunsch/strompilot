import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      // In dev, forward the Netlify function path directly to the upstream API.
      // In production, the real Netlify function handles it server-side.
      '/.netlify/functions/spot-prices': {
        target: 'https://api.energy-charts.info',
        changeOrigin: true,
        rewrite: (path) => {
          const u = new URL(path, 'http://localhost')
          return `/price${u.search}`
        },
      },
    },
  },
})
