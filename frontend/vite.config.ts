import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
// The bot API answers CORS itself and stays bound to 127.0.0.1, so the
// dashboard calls it directly (src/api/client.ts, default http://127.0.0.1:3000).
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
