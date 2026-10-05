import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {defineConfig, loadEnv, Plugin} from 'vite';

function bundleAnalyzerPlugin(): Plugin {
  return {
    name: 'halal-ottawa-bundle-analyzer',
    generateBundle(_options, bundle) {
      const chunks: any[] = [];
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'chunk') {
          const code = item.code || '';
          const rawBytes = Buffer.byteLength(code, 'utf8');
          const gzipBytes = zlib.gzipSync(code).length;
          const modules = Object.entries(item.modules || {})
            .map(([id, mod]: [string, any]) => ({
              id: id.replace(process.cwd() + '/', ''),
              renderedLength: mod.renderedLength || 0,
            }))
            .sort((a, b) => b.renderedLength - a.renderedLength);

          chunks.push({
            fileName,
            isEntry: item.isEntry,
            rawKB: +(rawBytes / 1024).toFixed(2),
            gzipKB: +(gzipBytes / 1024).toFixed(2),
            imports: item.imports,
            topModules: modules.slice(0, 10),
          });
        }
      }

      const entry = chunks.find(c => c.isEntry);
      const report = {
        generatedAt: new Date().toISOString(),
        entryChunk: entry?.fileName || null,
        chunks,
      };

      const outDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      fs.writeFileSync(path.join(outDir, 'bundle-stats.json'), JSON.stringify(report, null, 2), 'utf8');
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), bundleAnalyzerPlugin()],
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, '.') },
        { find: /^react$/, replacement: path.resolve(__dirname, 'node_modules/react') },
        { find: /^react-dom$/, replacement: path.resolve(__dirname, 'node_modules/react-dom') },
        ...(mode === 'production'
          ? [
              {
                find: /^react-router\/dom$/,
                replacement: path.resolve(__dirname, 'node_modules/react-router/dist/production/dom-export.mjs'),
              },
              {
                find: /^react-router$/,
                replacement: path.resolve(__dirname, 'node_modules/react-router/dist/production/index.mjs'),
              },
            ]
          : []),
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
        format: {
          comments: false,
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('vite/preload-helper') ||
              id.includes('src/utils/safeStorage') ||
              id.includes('src/utils/platform')
            ) {
              return 'vendor';
            }
            if (
              id.includes('src/firebase.ts') ||
              id.includes('firebase-applet-config.json') ||
              id.includes('firestoreErrorHandler')
            ) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('@google/genai')) {
                return 'vendor-genai';
              }
              if (id.includes('marked') || id.includes('dompurify')) {
                return 'vendor-markdown';
              }
              if (id.includes('qrcode') || id.includes('html-to-image')) {
                return 'vendor-share';
              }
              if (id.includes('leaflet') || id.includes('react-leaflet')) {
                return 'vendor-leaflet';
              }
              if (id.includes('date-fns')) {
                return 'vendor-date-fns';
              }
              if (
                id.includes('/react/') ||
                id.includes('/react-dom/') ||
                id.includes('/react-router') ||
                id.includes('/scheduler/') ||
                id.includes('/react-helmet-async/')
              ) {
                return 'vendor';
              }
            }
          }
        }
      }
    }
  };
});
