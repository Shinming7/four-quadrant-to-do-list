import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    viteSingleFile(),
    {
      name: 'remove-single-file-module-attribute',
      enforce: 'post',
      transformIndexHtml(html) {
        return html.replace('<script type="module" crossorigin>', '<script>')
      },
    },
  ],
})
