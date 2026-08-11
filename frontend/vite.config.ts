import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      // Proxy the bot's REST API so the frontend never talks cross-origin.
      // The API itself stays bound to 127.0.0.1 only.
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        // The API routes live at the root (/health), not under /api — strip the prefix.
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
