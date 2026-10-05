import { defineConfig } from 'vite';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function localOcrAssets() {
  return {
    name: 'local-ocr-assets',
    configureServer(server) {
      server.middlewares.use('/tesseract-core', (req, res, next) => {
        const filename = req.url?.split('?')[0]?.replace(/^\//, '');
        if (!filename || filename.includes('..') || !/^[\w.-]+\.(?:js|wasm)$/.test(filename)) return next();
        const asset = resolve('node_modules/tesseract.js-core', filename);
        if (!existsSync(asset)) return next();
        res.setHeader('Content-Type', filename.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.end(readFileSync(asset));
      });
    },
    writeBundle() {
      const source = resolve('node_modules/tesseract.js-core');
      const target = resolve('dist/tesseract-core');
      mkdirSync(target, { recursive: true });
      for (const filename of [
        'tesseract-core.wasm.js', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd.wasm.js',
        'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd.wasm.js',
        'tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core.wasm', 'tesseract-core-lstm.wasm',
        'tesseract-core-simd.wasm', 'tesseract-core-simd-lstm.wasm', 'tesseract-core-relaxedsimd.wasm',
        'tesseract-core-relaxedsimd-lstm.wasm',
      ]) cpSync(resolve(source, filename), resolve(target, filename));
    },
  };
}


export default defineConfig({ plugins: [localOcrAssets()] });
