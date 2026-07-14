import { defineConfig } from 'tsup';

/**
 * @ado/shared cift-format derlenir (ESM + CJS + d.ts).
 * Neden: ESM kaynak (`.js` uzantili import'lar) CommonJS backend'i (NestJS) kirmasin.
 * Backend `require` -> dist/index.cjs, frontend (Vite) `import` -> dist/index.js.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
});
