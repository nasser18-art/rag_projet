import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Configuration minimale : le template Figma Make embarque une plomberie
// (injection de titre, surcouche d'erreurs, route de prévisualisation) qui ne
// sert qu'à Figma. Elle est remplacée par un proxy vers FastAPI en développement.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  build: {
    // Sortie hors de « dist », qui n'est pas conservé par l'environnement.
    outDir: 'app-dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Aperçu servi derrière le proxy de la plateforme : son nom d'hôte doit être accepté.
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
})
