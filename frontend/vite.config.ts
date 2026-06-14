import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Destino del proxy de /api:
//  - local (npm run dev):        http://localhost:8000  (default)
//  - docker dev (hot reload):    http://api:8000        (VITE_API_PROXY)
const apiProxy = process.env.VITE_API_PROXY ?? 'http://localhost:8000'

// En contenedores los eventos de fichero (inotify) a veces no se propagan;
// activar polling con VITE_POLLING=1 garantiza el hot reload.
const usePolling = process.env.VITE_POLLING === '1'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxy,
        changeOrigin: true,
      },
    },
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
  },
})
