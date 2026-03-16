/**
 * Firefox-specific Vite build configuration.
 *
 * Unlike the Chrome build (which uses @crxjs/vite-plugin), this config uses
 * plain Vite/Rollup to produce a standard Firefox MV3 extension structure.
 *
 * Build strategy:
 *   - Popup: HTML page with ES module scripts (extension pages support modules)
 *   - Background: ES module (Firefox MV3 supports type: "module" in background.scripts)
 *   - Content pre-blur: Self-contained (no imports, works as classic script)
 *   - Content main: ES module loaded via content-loader.js (IIFE wrapper)
 *   - Filter worker: ES module (Web Workers support type: "module")
 *
 * Output: dist-firefox/
 */

import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync, cpSync } from 'fs';

// ---- Firefox manifest (inline — no crx defineManifest needed) ----

const firefoxManifest = {
  manifest_version: 3,
  name: 'PG Patrol',
  version: '1.0.0',
  description:
    'Free parental control web filter — replaces profanity with funny words, blocks NSFW images using on-device AI',
  permissions: ['storage', 'activeTab', 'alarms'],
  host_permissions: ['<all_urls>'],
  browser_specific_settings: {
    gecko: {
      id: 'pg-patrol@nareshnavinash.com',
      strict_min_version: '121.0',
    },
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },
  icons: {
    '16': 'icons/icon-16.png',
    '32': 'icons/icon-32.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
  background: {
    scripts: ['background.js'],
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['content-pre-blur.js'],
      run_at: 'document_start',
    },
    {
      matches: ['<all_urls>'],
      js: ['content-loader.js'],
      run_at: 'document_end',
    },
  ],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'",
  },
  web_accessible_resources: [
    {
      resources: ['content.js', 'chunks/*', 'filter-worker.js', 'cartoons/*'],
      matches: ['<all_urls>'],
    },
    {
      resources: ['assets/models/*'],
      matches: ['<all_urls>'],
    },
    {
      resources: ['assets/ml-models/**/*'],
      matches: ['<all_urls>'],
    },
  ],
};

// ---- Utility: recursive directory copy ----

function copyDirRecursive(src: string, dest: string): void {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = resolve(src, entry.name);
    const destPath = resolve(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

// ---- Plugin: post-build tasks (manifest, loader, assets) ----

function firefoxPostBuildPlugin() {
  return {
    name: 'firefox-post-build',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist-firefox');

      // 1. Generate content-loader.js — tiny IIFE that imports the real ES module
      writeFileSync(
        resolve(outDir, 'content-loader.js'),
        '(async()=>{const b=typeof browser!=="undefined"?browser:chrome;await import(b.runtime.getURL("content.js"))})();\n',
      );

      // 2. Write manifest.json
      writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(firefoxManifest, null, 2));

      // 3. Copy icons
      const iconsDir = resolve(outDir, 'icons');
      if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
      for (const size of ['16', '32', '48', '128']) {
        const src = resolve(__dirname, `src/assets/icons/icon-${size}.png`);
        if (existsSync(src)) {
          copyFileSync(src, resolve(iconsDir, `icon-${size}.png`));
        }
      }

      // 4. Copy cartoon placeholders
      const cartoonsSrc = resolve(__dirname, 'src/assets/cartoons');
      if (existsSync(cartoonsSrc)) {
        cpSync(cartoonsSrc, resolve(outDir, 'cartoons'), { recursive: true });
      }

      // 5. Copy ONNX Runtime WASM + NSFW model
      const modelsDir = resolve(outDir, 'assets/models');
      if (!existsSync(modelsDir)) mkdirSync(modelsDir, { recursive: true });

      const wasmSrc = resolve(
        __dirname,
        'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
      );
      if (existsSync(wasmSrc)) {
        copyFileSync(wasmSrc, resolve(modelsDir, 'ort-wasm-simd-threaded.wasm'));
      }

      const mjsSrc = resolve(
        __dirname,
        'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
      );
      if (existsSync(mjsSrc)) {
        copyFileSync(mjsSrc, resolve(modelsDir, 'ort-wasm-simd-threaded.mjs'));
      }

      // NSFW ONNX model (prefer quantized variant)
      const quantModelSrc = resolve(__dirname, 'src/assets/models/nsfw-q8.onnx');
      const modelSrc = resolve(__dirname, 'src/assets/models/nsfw.onnx');
      if (existsSync(quantModelSrc)) {
        copyFileSync(quantModelSrc, resolve(modelsDir, 'nsfw.onnx'));
      } else if (existsSync(modelSrc)) {
        copyFileSync(modelSrc, resolve(modelsDir, 'nsfw.onnx'));
      }

      // 6. Copy ML text classifier model (Transformers.js)
      const mlModelsDir = resolve(outDir, 'assets/ml-models');
      if (!existsSync(mlModelsDir)) mkdirSync(mlModelsDir, { recursive: true });

      const mlModelSrc = resolve(__dirname, 'src/assets/ml-models');
      if (existsSync(mlModelSrc)) {
        copyDirRecursive(mlModelSrc, mlModelsDir);
      }

      // Transformers.js WASM files
      const wasmOutDir = resolve(mlModelsDir, 'wasm');
      if (!existsSync(wasmOutDir)) mkdirSync(wasmOutDir, { recursive: true });
      const transformersOrtDir = resolve(__dirname, 'node_modules/@huggingface/transformers/dist');
      const neededWasm = new Set(['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd.wasm']);
      if (existsSync(transformersOrtDir)) {
        for (const f of readdirSync(transformersOrtDir)) {
          if (f.endsWith('.wasm') && neededWasm.has(f)) {
            copyFileSync(resolve(transformersOrtDir, f), resolve(wasmOutDir, f));
          }
        }
      }

      console.log('Firefox post-build: manifest, loader, icons, and ONNX assets copied.');
    },
  };
}

// ---- Vite config ----

export default defineConfig({
  plugins: [preact(), tailwindcss(), firefoxPostBuildPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/client': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      // Use WASM-only ORT entry (no WebGPU/WebGL) — 52 KB vs 396 KB
      'onnxruntime-web': 'onnxruntime-web/wasm',
    },
    conditions: ['onnxruntime-web-use-extern-wasm'],
  },
  build: {
    outDir: 'dist-firefox',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/index.firefox.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        'content-pre-blur': resolve(__dirname, 'src/content/pre-blur.ts'),
        'filter-worker': resolve(__dirname, 'src/content/filter-worker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
