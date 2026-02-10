import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import electronPlugin from 'vite-plugin-electron'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Build optimization — smaller bundles = less memory
  build: {
    // Enable chunk splitting for lazy-loaded routes
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks — only loaded when needed
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth'],
          'vendor-styled': ['styled-components'],
        },
      },
    },
    // Reduce source map size in dev
    sourcemap: false,
    // Minimize chunk size
    chunkSizeWarningLimit: 500,
  },
  plugins: [
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['uiohook-napi'],
              output: {
                format: 'cjs',
              },
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      // Ployfill the Electron and Node.js built-in modules for Renderer process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: {},
    }),
    // Additional preload for floating widget — built separately
    ...electronPlugin({
      entry: path.join(__dirname, 'electron/preload-widget.ts'),
      vite: {
        build: {
          outDir: 'dist-electron',
          rollupOptions: {
            output: {
              entryFileNames: 'preload-widget.js',
              format: 'cjs',
            },
          },
        },
      },
    }),
  ],
})
