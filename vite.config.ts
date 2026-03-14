import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import manifest from './src/manifest';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

/**
 * Vite plugin to copy the ONNX Runtime WASM file and the NSFW model
 * into dist/assets/models/ after build. Loaded at runtime via chrome.runtime.getURL.
 * Only copies the basic WASM backend (12 MB) — no WebGPU/WebGL variants.
 */
function copyOnnxAssets() {
  return {
    name: 'copy-onnx-assets',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist/assets/models');
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true });
      }

      // Copy only the basic WASM backend
      const wasmSrc = resolve(
        __dirname,
        'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
      );
      if (existsSync(wasmSrc)) {
        copyFileSync(wasmSrc, resolve(outDir, 'ort-wasm-simd-threaded.wasm'));
      }

      // Also copy the .mjs proxy needed by ORT to instantiate the WASM
      const mjsSrc = resolve(
        __dirname,
        'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
      );
      if (existsSync(mjsSrc)) {
        copyFileSync(mjsSrc, resolve(outDir, 'ort-wasm-simd-threaded.mjs'));
      }

      // Copy the NSFW ONNX model (ViT-Tiny) if it exists
      const modelSrc = resolve(__dirname, 'src/assets/models/nsfw.onnx');
      if (existsSync(modelSrc)) {
        copyFileSync(modelSrc, resolve(outDir, 'nsfw.onnx'));
      }

      // Also check for the quantized variant
      const quantModelSrc = resolve(__dirname, 'src/assets/models/nsfw-q8.onnx');
      if (existsSync(quantModelSrc)) {
        copyFileSync(quantModelSrc, resolve(outDir, 'nsfw.onnx'));
      }

      // ---- ML text classifier model (Transformers.js) ----
      const mlModelsDir = resolve(__dirname, 'dist/assets/ml-models');
      if (!existsSync(mlModelsDir)) {
        mkdirSync(mlModelsDir, { recursive: true });
      }

      // Copy ML model files (recursive)
      const mlModelSrc = resolve(__dirname, 'src/assets/ml-models');
      if (existsSync(mlModelSrc)) {
        copyDirRecursive(mlModelSrc, mlModelsDir);
      }

      // Copy Transformers.js WASM files
      const wasmOutDir = resolve(mlModelsDir, 'wasm');
      if (!existsSync(wasmOutDir)) {
        mkdirSync(wasmOutDir, { recursive: true });
      }
      const transformersOrtDir = resolve(
        __dirname,
        'node_modules/@huggingface/transformers/dist',
      );
      if (existsSync(transformersOrtDir)) {
        for (const f of readdirSync(transformersOrtDir)) {
          if (f.endsWith('.wasm')) {
            copyFileSync(resolve(transformersOrtDir, f), resolve(wasmOutDir, f));
          }
        }
      }
    },
  };
}

/** Recursively copy a directory. */
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

export default defineConfig({
  plugins: [
    preact(),
    tailwindcss(),
    crx({ manifest }),
    copyOnnxAssets(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/client': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      // Use WASM-only ORT entry (no WebGPU/WebGL) — 52 KB vs 396 KB
      'onnxruntime-web': 'onnxruntime-web/wasm',
    },
    conditions: ['onnxruntime-web-use-extern-wasm'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        offscreen: resolve(__dirname, 'src/ml-inference/offscreen.html'),
        'filter-worker': resolve(__dirname, 'src/content/filter-worker.ts'),
      },
    },
  },
});
