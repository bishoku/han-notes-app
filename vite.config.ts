import { defineConfig, type ESBuildOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

  return {
    esbuild: isBuild ? ({ drop: ['console', 'debugger'] } as ESBuildOptions) : undefined,
    // GitHub Pages uses /han-notes-app/ base path; Tauri uses /
    base: isBuild && !process.env.TAURI_ENV_PLATFORM
      ? '/han-notes-app/'
      : '/',
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@codemirror') || id.includes('@lezer') || id.includes('@uiw/react-codemirror')) {
              return 'vendor-codemirror';
            }
            if (id.includes('cytoscape')) {
              return 'vendor-graph';
            }
            if (id.includes('isomorphic-git')) {
              return 'vendor-git';
            }
            if (id.includes('pdfjs-dist')) {
              return 'vendor-pdf';
            }
            if (id.includes('tesseract.js')) {
              return 'vendor-ocr';
            }
            if (id.includes('@xenova/transformers') || id.includes('onnxruntime')) {
              return 'vendor-ai-embeddings';
            }
            return undefined;
          },
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',  // Show update prompt, don't auto-reload
        includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // Cache app shell (JS, MJS PDF worker, CSS, HTML, WASM) — NOT user data
          globPatterns: ['**/*.{js,mjs,css,html,woff2,png,svg,ico,wasm}'],
          // Exclude unused legacy CodeMirror modes and Excalidraw locale chunks from eager precache
          globIgnores: [
            '**/models/**',
            '**/assets/*-json-*.js',
            '**/assets/apl-*.js',
            '**/assets/asciiarmor-*.js',
            '**/assets/asn1-*.js',
            '**/assets/asterisk-*.js',
            '**/assets/brainfuck-*.js',
            '**/assets/cobol-*.js',
            '**/assets/coffeescript-*.js',
            '**/assets/commonlisp-*.js',
            '**/assets/crystal-*.js',
            '**/assets/cypher-*.js',
            '**/assets/d-*.js',
            '**/assets/dtl-*.js',
            '**/assets/Dylan-*.js',
            '**/assets/ebnf-*.js',
            '**/assets/ecl-*.js',
            '**/assets/eiffel-*.js',
            '**/assets/elm-*.js',
            '**/assets/erlang-*.js',
            '**/assets/factor-*.js',
            '**/assets/fcl-*.js',
            '**/assets/forth-*.js',
            '**/assets/fortran-*.js',
            '**/assets/gas-*.js',
            '**/assets/gherkin-*.js',
            '**/assets/groovy-*.js',
            '**/assets/haskell-*.js',
            '**/assets/haxe-*.js',
            '**/assets/idl-*.js',
            '**/assets/jinja2-*.js',
            '**/assets/julia-*.js',
            '**/assets/livescript-*.js',
            '**/assets/mathematica-*.js',
            '**/assets/mbox-*.js',
            '**/assets/mirc-*.js',
            '**/assets/mllike-*.js',
            '**/assets/modelica-*.js',
            '**/assets/mscgen-*.js',
            '**/assets/mumps-*.js',
            '**/assets/nsis-*.js',
            '**/assets/ntriples-*.js',
            '**/assets/octave-*.js',
            '**/assets/oz-*.js',
            '**/assets/pascal-*.js',
            '**/assets/perl-*.js',
            '**/assets/pig-*.js',
            '**/assets/powerShell-*.js',
            '**/assets/properties-*.js',
            '**/assets/protobuf-*.js',
            '**/assets/puppet-*.js',
            '**/assets/q-*.js',
            '**/assets/r-*.js',
            '**/assets/rpm-*.js',
            '**/assets/ruby-*.js',
            '**/assets/sas-*.js',
            '**/assets/scheme-*.js',
            '**/assets/sieve-*.js',
            '**/assets/smalltalk-*.js',
            '**/assets/solr-*.js',
            '**/assets/sparql-*.js',
            '**/assets/spreadsheet-*.js',
            '**/assets/stex-*.js',
            '**/assets/stylus-*.js',
            '**/assets/swift-*.js',
            '**/assets/tcl-*.js',
            '**/assets/textile-*.js',
            '**/assets/tiddlywiki-*.js',
            '**/assets/tiki-*.js',
            '**/assets/troff-*.js',
            '**/assets/ttcn-*.js',
            '**/assets/turtle-*.js',
            '**/assets/vb-*.js',
            '**/assets/vbscript-*.js',
            '**/assets/velocity-*.js',
            '**/assets/verilog-*.js',
            '**/assets/vhdl-*.js',
            '**/assets/webidl-*.js',
            '**/assets/xquery-*.js',
            '**/assets/yacas-*.js',
            '**/assets/z80-*.js',
          ],
          // Network-first for navigation requests → always get latest HTML
          navigateFallback: 'index.html',
          // Clean old caches on activate
          cleanupOutdatedCaches: true,
          // Skip waiting to activate new SW immediately when user accepts
          skipWaiting: false,
          clientsClaim: true,
          runtimeCaching: [
            {
              // Google Fonts (if used)
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Local ONNX semantic search embedding model & tokenizer assets
              urlPattern: /\/models\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'han-local-ai-models',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // On-demand CodeMirror language modes & Excalidraw locale chunks
              urlPattern: /\/assets\/.*\.js$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'han-lazy-assets',
                expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: 'H.A.N. — Hierarchical Adaptive Notebook',
          short_name: 'H.A.N.',
          description: 'A local-first, privacy-focused note-taking app with task tracking, decision logging, and wiki-links.',
          start_url: './',
          display: 'standalone',
          background_color: '#0a0a0f',
          theme_color: '#4F46E5',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
