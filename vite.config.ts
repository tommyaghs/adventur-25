import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Ascolta su tutte le interfacce di rete
    port: 5173,
    strictPort: false,
  },
  // Configurazione per GitHub Pages
  // Sostituisci 'adventur-25' con il nome del tuo repository
  base: process.env.NODE_ENV === 'production' ? '/adventur-25/' : '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
