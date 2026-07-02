import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: [
      'it-assets.caavagroup.com',
      'devices.sostinewaliaula.site',
      '192.0.1.129'
    ],
    proxy: {
      '/api': {
          target: 'http://localhost:3001',
        // target: 'https://devicesbackend.sostinewaliaula.site',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
               console.log('Proxying request:', req.method, req.url, '→', 'http://localhost:3001' + req.url);
            // console.log('Proxying request:', req.method, req.url, '→', 'https://devicesbackend.sostinewaliaula.site' + req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Proxy response:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  build: {
    // Optimize build for production
    minify: 'terser',
    sourcemap: false, // Disable source maps in production
    rollupOptions: {
      output: {
        // Obfuscate chunk names with longer hashes
        chunkFileNames: 'assets/[hash:16].js',
        entryFileNames: 'assets/[hash:16].js',
        assetFileNames: 'assets/[hash:16].[ext]',
        // Split chunks to make reverse engineering harder
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['lucide-react', 'recharts'],
          utils: ['axios']
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Additional optimizations
    target: 'es2015',
    cssCodeSplit: true,
    reportCompressedSize: false,
    // Remove console logs in production
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  // Hide source files in production
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
})
