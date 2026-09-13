import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    // tailwindcss() only ever touches the renderer's own Vite pipeline (it
    // hooks in as a PostCSS-equivalent transform on renderer CSS) — main/
    // preload builds above have no plugins array and are untouched.
    plugins: [react(), tailwindcss()]
  }
})
